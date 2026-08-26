import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { handleMulterError } from '../utils/multer.js';
import { slotUploader, uploadSlotsToCloudinary } from '../utils/slotUpload.js';
import { updateSiteSettingSchema } from '../validators/siteSetting.validator.js';

const router = Router();

// Two independent images on one document: the about-section photo and the site logo.
const SLOTS = [{ name: 'aboutImage' }, { name: 'logo' }];

// Public read — homepage about section, stats, warranty policy, contact info
router.get('/', getSettings);

// Admin-only write — single settings document
router.put(
  '/',
  isAuthorized,
  // 'siteSetting:write' — the slug that actually exists in permissions.constant.js.
  // This route asked for 'settings:write', which is defined nowhere, so any non-Admin
  // role would have been refused. Admin bypasses permission checks, which is why it
  // went unnoticed.
  restrictTo('siteSetting:write'),
  slotUploader(SLOTS),
  handleMulterError,
  validate(updateSiteSettingSchema), // validate body first, before hitting Cloudinary
  uploadSlotsToCloudinary('3mmile/settings', SLOTS),
  updateSettings,
);

export default router;