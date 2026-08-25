import { Router } from 'express';
import { getBlogIntroContent, updateBlogIntroContent } from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { handleMulterError } from '../utils/multer.js';
import { slotUploader, uploadSlotsToCloudinary } from '../utils/slotUpload.js';
import { updateBlogIntroSchema } from '../validators/sections.validator.js';

const router = Router();
const SLOTS = [{ name: 'image' }];

// Public read — the banner above the article grid.
router.get('/', getBlogIntroContent);

router.put(
  '/',
  isAuthorized,
  restrictTo('blogPost:write'),
  slotUploader(SLOTS),
  handleMulterError,
  validate(updateBlogIntroSchema), // validate body first, before hitting Cloudinary
  uploadSlotsToCloudinary('3mmile/blog', SLOTS),
  updateBlogIntroContent,
);

export default router;
