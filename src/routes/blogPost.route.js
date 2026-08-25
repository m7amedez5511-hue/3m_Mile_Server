import { Router } from 'express';
import {
  getBlogPosts,
  getBlogPost,
  getBlogPostBySlugHandler,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
} from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { uploaders, uploadToCloudinary, handleMulterError } from '../utils/multer.js';
import { createBlogPostSchema, updateBlogPostSchema } from '../validators/blogPost.validator.js';

const router = Router();

// Public reads. Posts are addressed by slug on the public site (`/{slug}`), so the
// slug route is what the frontend actually calls; `/:id` serves the admin.
router.get('/', getBlogPosts);
router.get('/slug/:slug', getBlogPostBySlugHandler);
router.get('/:id', getBlogPost);

// Admin-only writes
// NOTE: validate() runs BEFORE uploadToCloudinary() on purpose.
// If validation fails after the image is already uploaded, we'd end up
// with an orphaned file sitting on Cloudinary forever. Rejecting bad
// input first means we only ever upload a file once we know the rest
// of the payload is valid.
router.post(
  '/',
  isAuthorized,
  restrictTo('blogPost:write'),
  uploaders.bannerImage.single('coverImage'),
  handleMulterError,
  validate(createBlogPostSchema),
  uploadToCloudinary('3mmile/blog'),
  createBlogPost,
);

router.put(
  '/:id',
  isAuthorized,
  restrictTo('blogPost:write'),
  uploaders.bannerImage.single('coverImage'),
  handleMulterError,
  validate(updateBlogPostSchema),
  uploadToCloudinary('3mmile/blog'),
  updateBlogPost,
);

router.delete('/:id', isAuthorized, restrictTo('blogPost:delete'), deleteBlogPost);

export default router;