import { Router } from 'express';
import { getGalleryIntroContent, updateGalleryIntroContent } from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { updateGalleryIntroSchema } from '../validators/sections.validator.js';

const router = Router();

// Public read — headings above the two work galleries. Text only, so no upload
// middleware: the gallery items themselves are managed at /gallery.
router.get('/', getGalleryIntroContent);

router.put(
  '/',
  isAuthorized,
  restrictTo('gallery:write'),
  validate(updateGalleryIntroSchema),
  updateGalleryIntroContent,
);

export default router;
