import { Router } from 'express';
import {
  getGalleryItems,
  getGalleryItem,
  createGalleryImage,
  createGalleryVideo,
  updateGalleryItem,
  deleteGalleryItem,
} from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { uploaders, uploadToCloudinary, handleMulterError } from '../utils/multer.js';
import { createGalleryItemSchema, updateGalleryItemSchema } from '../validators/galleryItem.validator.js';

const router = Router();

// Public reads
router.get('/', getGalleryItems);
router.get('/:id', getGalleryItem);

// Admin-only writes — image and video are two distinct upload endpoints
// so each can use the right multer/mime-type config.
router.post(
  '/images',
  isAuthorized,
  restrictTo('gallery:write'),
  uploaders.bannerImage.single('file'),
  handleMulterError,
  validate(createGalleryItemSchema), // validate body first, before hitting Cloudinary
  uploadToCloudinary('3mmile/gallery/images'),
  createGalleryImage,
);

router.post(
  '/videos',
  isAuthorized,
  restrictTo('gallery:write'),
  uploaders.video.single('file'),
  handleMulterError,
  validate(createGalleryItemSchema), // validate body first, before hitting Cloudinary
  uploadToCloudinary('3mmile/gallery/videos'),
  createGalleryVideo,
);

// Metadata-only update (title/order/service/isActive). To replace the
// actual media file, delete the item and upload a new one instead —
// keeps this route's mime-type handling simple and unambiguous.
router.put(
  '/:id',
  isAuthorized,
  restrictTo('gallery:write'),
  validate(updateGalleryItemSchema),
  updateGalleryItem,
);

router.delete('/:id', isAuthorized, restrictTo('gallery:delete'), deleteGalleryItem);

export default router;