import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { safeDeleteCloudinaryImage } from '../utils/softDeleteImage.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';
import { replaceCloudinaryMedia } from '../utils/replaceCloudinaryMedia.js';

const RESOURCE_FOLDER = { image: '3mmile/gallery/images', video: '3mmile/gallery/videos' };
const galleryCrud = crudService('GalleryItem');

// whitelist of fields allowed to be updated directly by the client (metadata-only, media file is immutable)
const UPDATABLE_FIELDS = ['title', 'service', 'order', 'isActive'];

// get paginated list of gallery items with optional type/service filter
export const listGalleryItems = async ({ page = 1, limit = 12, type, service } = {}) => {
  //1 build filter object
  const filter = { isDeleted: false };
  //2 if type filter is provided, add it to the filter object
  if (type) filter.type = type;
  //3 if service filter is provided, add it to the filter object
  if (service) filter.service = service;
  //4 fetch paginated results sorted by order and createdAt, populating the linked service
 return galleryCrud.findAndCountAll(filter, {
  page, limit,
  sort: { order: 1, createdAt: -1 },
  populate: [{ path: 'service', localField: 'service', collection: 'services' }],
});
};

// get a single gallery item by ID
export const getGalleryItemById = async (id) => {
  //1 fetch the gallery item by ID, populating the linked service
  const item = await galleryCrud.findByPk(id, {
  populate: [{ path: 'service', localField: 'service', collection: 'services' }],
});
  //2 if not found or isDeleted, throw a 404 error
  if (!item || item.isDeleted) {
    throw createAppError(404, 'gallery_item_not_found');
  }
  //3 return the fetched gallery item
  return item;
};

// create a new gallery item (image or video); type is fixed per-route,
// passed in explicitly rather than trusted from the request body
export const createGalleryItem = async (req, type) => {
  //1 the media file is required for both images and videos
  if (!req.uploadedFile) {
    throw createAppError(400, 'file_is_required');
  }
  //2 extract gallery item data from request body
  const { title, service, order, isActive } = req.body;
  const data = {
    title: title ?? '',
    type,
    url: req.uploadedFile.url,
    publicId: req.uploadedFile.publicId,
    service: service || null,
    order: order ?? 0,
    isActive: isActive ?? true,
  };
  //3 create the gallery item in the database
  const item = await galleryCrud.create(data);
  //4 log audit for gallery item creation
  logAudit({ ...actorFromReq(req), action: 'CREATE', resource: 'GalleryItem', details: { id: item._id, type } });
  //5 return the created gallery item
  return item;
};

// update gallery item metadata by ID — the media file itself is immutable;
// delete and re-upload to replace it (see routes/galleryItem.route.js)


export const updateGalleryItem = async (id, req) => {
  //1 fetch the existing gallery item by ID
  const existing = await galleryCrud.findByPk(id);
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'gallery_item_not_found');
  }

  //2 whitelist metadata fields
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }

  //3 if a new media file is uploaded, replace the old one on Cloudinary (image or video)
  // Note: req.file is set by multer, req.uploadedFile is set by uploadGalleryMediaToCloudinary
  if (req.file) {
    const uploadedGroup = req.file.mimetype.startsWith('image/')
      ? 'image'
      : req.file.mimetype.startsWith('video/')
      ? 'video'
      : null;

    if (uploadedGroup !== existing.type) {
      throw createAppError(400, 'media_type_mismatch');
    }

    //4 replace the old media file on Cloudinary with the new one, and update the URL and publicId in the data object
    const uploaded = await replaceCloudinaryMedia({
      file: req.file,
      folder: RESOURCE_FOLDER[existing.type],
      resourceType: existing.type,
      oldPublicId: existing.publicId,
    });

    data.url = uploaded.url;
    data.publicId = uploaded.publicId;
  }

  //5 update the gallery item in the database (metadata + media if provided)
  const updated = await galleryCrud.findOneAndUpdate({ _id: id }, data);
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'GalleryItem', details: { id, mediaReplaced: !!req.file } });
  return updated;
};
// soft-delete a gallery item by ID, including its media file on Cloudinary
export const deleteGalleryItem = async (id, req) => {
  //1 fetch the existing gallery item by ID
  const existing = await galleryCrud.findByPk(id);
  //2 if not found or already deleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'gallery_item_not_found');
  }
  //3 delete the media file (image or video) from Cloudinary
await safeDeleteCloudinaryImage(existing.publicId, {
  resourceType: existing.type, // 'image' | 'video' — was missing, defaulted to 'image' for videos too
  resource: 'GalleryItem',
  id,
  reason: 'item_deleted',
});
  //4 soft-delete: mark isDeleted instead of removing the document
  const result = await galleryCrud.findOneAndUpdate({ _id: id }, { isDeleted: true, isActive: false });
  //5 log audit for gallery item deletion
  logAudit({ ...actorFromReq(req), action: 'DELETE', resource: 'GalleryItem', details: { id } });
  //6 return the result of the soft deletion
  return result;
};