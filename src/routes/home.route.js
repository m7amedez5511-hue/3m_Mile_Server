import { Router } from 'express';
import { getHome, updateHome } from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { handleMulterError } from '../utils/multer.js';
import { slotUploader, uploadSlotsToCloudinary, HOME_SLOTS } from '../utils/slotUpload.js';
import { updateHomeContentSchema } from '../validators/homeContent.validator.js';

const router = Router();

// Public read — the homepage is one document, fetched in a single request.
router.get('/', getHome);

// Admin-only write. The hero video is the largest upload on the site, so the slot
// uploader is given the 50 MB ceiling rather than the 10 MB default.
router.put(
  '/',
  isAuthorized,
  restrictTo('siteSetting:write'),
  slotUploader(HOME_SLOTS, 50 * 1024 * 1024),
  handleMulterError,
  validate(updateHomeContentSchema), // validate body first, before hitting Cloudinary
  uploadSlotsToCloudinary('3mmile/home', HOME_SLOTS),
  updateHome,
);

export default router;
