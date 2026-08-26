import multer from 'multer';
import { uploadImage } from './Cloudinary.config.js';
import { logger } from './winston.js';

/**
 * Named-slot uploads.
 *
 * The existing `uploadToCloudinary` handles one file (`req.uploadedFile`) or one
 * unnamed array (`req.uploadedFiles`). Neither can express "this file is the hero, that
 * one is the wide banner" — but the service detail page has four differently-shaped
 * containers, and putting the wrong image in one of them breaks the layout.
 *
 * So this middleware keeps the field *name* attached all the way through and returns
 * `req.uploadedSlots = { heroImage: {url, publicId}, collage: [{url, publicId}, ...] }`.
 *
 * Slots are optional by design: a partial update that uploads only `wideImage` leaves
 * every other slot untouched, which is what "replace just this image" means in the
 * admin UI.
 */

const IMAGE_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
// Browsers send video/quicktime for .mov, video/x-msvideo for .avi and
// video/x-ms-wmv for .wmv — the bare `video/mov`/`video/avi` forms never occur.
export const VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv'];

class SlotUploadError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'SlotUploadError';
  }
}

/**
 * @param {Array<{name: string, maxCount?: number, video?: boolean}>} slots
 * @param {number} fileSizeLimit bytes
 */
export const slotUploader = (slots, fileSizeLimit = 10 * 1024 * 1024) => {
  // Allowed types are per FIELD, not per group: a video-capable slot (heroVideo)
  // must not make every image slot in the same form accept video files.
  const allowedByField = new Map(
    slots.map((s) => [s.name, s.video ? [...IMAGE_MIME, ...VIDEO_MIME] : IMAGE_MIME]),
  );

  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: fileSizeLimit, files: slots.reduce((n, s) => n + (s.maxCount || 1), 0) },
    fileFilter: (req, file, cb) => {
      const allowed = allowedByField.get(file.fieldname) ?? IMAGE_MIME;
      if (allowed.includes(file.mimetype)) return cb(null, true);
      cb(new SlotUploadError(`File type not allowed for '${file.fieldname}'. Allowed: ${allowed.join(', ')}`), false);
    },
  }).fields(slots.map(({ name, maxCount = 1 }) => ({ name, maxCount })));
};

/**
 * Uploads whatever `slotUploader` collected, preserving field names.
 * Attaches `req.uploadedSlots`. Single-count slots yield an object, multi-count slots
 * an array, so consumers never have to unwrap a one-element list.
 */
export const uploadSlotsToCloudinary = (folder, slots) => async (req, res, next) => {
  try {
    // `.fields()` gives {} rather than undefined when nothing was sent.
    if (!req.files || Object.keys(req.files).length === 0) return next();

    const byName = new Map(slots.map((s) => [s.name, s]));
    const uploadOne = async (file) => {
      const b64 = Buffer.from(file.buffer).toString('base64');
      const result = await uploadImage(`data:${file.mimetype};base64,${b64}`, folder, {
        public_id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        resource_type: 'auto',
      });
      return { url: result.url, publicId: result.publicId };
    };

    const uploaded = {};
    // Sequential per slot but parallel within a slot — keeps Cloudinary concurrency
    // bounded while the 3-image collage still uploads at once.
    for (const [name, files] of Object.entries(req.files)) {
      const spec = byName.get(name);
      const results = await Promise.all(files.map(uploadOne));
      uploaded[name] = (spec?.maxCount || 1) > 1 ? results : results[0];
    }

    req.uploadedSlots = uploaded;
    logger.info(`Uploaded slots to ${folder}: ${Object.keys(uploaded).join(', ')}`);
    next();
  } catch (error) {
    logger.error('Error in uploadSlotsToCloudinary:', error);
    // A corrupt/undecodable file is the client's fault (Cloudinary answers 400);
    // anything else (outage, auth) stays a 500.
    const status = error.http_code === 400 ? 400 : 500;
    next(new SlotUploadError(`Upload failed: ${error.message}`, status));
  }
};

/** Image slots on a Service, mirroring the named containers in the frontend layout. */
export const SERVICE_SLOTS = [
  { name: 'heroImage' },
  { name: 'wideImage' },
  { name: 'gridImage' },
  { name: 'collage', maxCount: 3 },
];

/**
 * Homepage media. The hero is a video plus its poster frame.
 *
 * Trust badges are addressed by index (`trustImage0`..`trustImage2`) rather than as one
 * 3-file array: the strip is a fixed three-slot row in the design, and indexing lets the
 * admin replace the middle badge without re-uploading the other two.
 */
export const HOME_SLOTS = [
  { name: 'heroVideo', video: true },
  { name: 'heroPoster' },
  { name: 'whyUsImage' },
  { name: 'branchesTileImage' },
  { name: 'galleryTileImage' },
  { name: 'trustImage0' },
  { name: 'trustImage1' },
  { name: 'trustImage2' },
];
