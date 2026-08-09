import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { uploaders, uploadToCloudinary, handleMulterError } from '../utils/multer.js';
import { updateSiteSettingSchema } from '../validators/siteSetting.validator.js';

const router = Router();

// Public read — homepage "من نحن" section, stats, warranty policy, contact info
router.get('/', getSettings);

// Admin-only write — single settings document
router.put(
  '/',
  isAuthorized,
  restrictTo('settings:write'),
  uploaders.bannerImage.single('aboutImage'),
  handleMulterError,
  validate(updateSiteSettingSchema), // validate body first, before hitting Cloudinary
  uploadToCloudinary('3mmile/settings'),
  updateSettings,
);

export default router;