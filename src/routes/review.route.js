import { Router } from 'express';
import {
  getReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
} from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { uploaders, uploadToCloudinary, handleMulterError } from '../utils/multer.js';
import { createReviewSchema, updateReviewSchema } from '../validators/review.validator.js';

const router = Router();

// Public reads — the homepage review carousel.
router.get('/', getReviews);
router.get('/:id', getReview);

// Admin-only writes. One screenshot per review, so the existing single-file uploader is
// the right tool here rather than the named-slot one.
router.post(
  '/',
  isAuthorized,
  restrictTo('siteSetting:write'),
  uploaders.bannerImage.single('image'),
  handleMulterError,
  validate(createReviewSchema), // validate body first, before hitting Cloudinary
  uploadToCloudinary('3mmile/reviews'),
  createReview,
);

router.put(
  '/:id',
  isAuthorized,
  restrictTo('siteSetting:write'),
  uploaders.bannerImage.single('image'),
  handleMulterError,
  validate(updateReviewSchema), // validate body first, before hitting Cloudinary
  uploadToCloudinary('3mmile/reviews'),
  updateReview,
);

router.delete('/:id', isAuthorized, restrictTo('siteSetting:delete'), deleteReview);

export default router;
