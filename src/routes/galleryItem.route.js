import { Router } from 'express';
import {
  getGalleryItems,
  getGalleryItem,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
} from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { uploaders, uploadGalleryMediaToCloudinary, handleMulterError } from '../utils/multer.js';
import { createGalleryItemSchema, updateGalleryItemSchema } from '../validators/galleryItem.validator.js';

const router = Router();

// Public reads
router.get('/', getGalleryItems);
router.get('/:id', getGalleryItem);

// Admin-only create — single endpoint for both image and video.
// Type is resolved from the uploaded file's mimetype (see uploadGalleryMediaToCloudinary),
// not trusted from the request body.
router.post(
  '/',
  isAuthorized,
  restrictTo('gallery:write'),
  uploaders.galleryMedia.single('file'),
  handleMulterError,
  validate(createGalleryItemSchema), // validate body first, before hitting Cloudinary
  uploadGalleryMediaToCloudinary,
  createGalleryItem,
);

// Admin-only update — metadata-only, media file is immutable.
// you must replece video to video and image to image, not vice versa. If you want to change the type, delete and re-upload.
router.put(
  '/:id',
  isAuthorized,
  restrictTo('gallery:write'),
  uploaders.galleryMedia.single('file'),
  handleMulterError,
  uploadGalleryMediaToCloudinary, // optional, only if a new file is uploaded
  validate(updateGalleryItemSchema),
  updateGalleryItem,
);

router.delete('/:id', isAuthorized, restrictTo('gallery:delete'), deleteGalleryItem);

export default router;