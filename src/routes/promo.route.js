import { Router } from 'express';
import { getPromoContent, getPromoAdmin, updatePromoContent } from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { handleMulterError } from '../utils/multer.js';
import { slotUploader, uploadSlotsToCloudinary } from '../utils/slotUpload.js';
import { updatePromoSchema } from '../validators/sections.validator.js';

const router = Router();
const SLOTS = [{ name: 'image' }];

/**
 * Public read returns null while the campaign is off — the frontend then renders no
 * modal. The admin read is a separate, authenticated route precisely so a retired
 * campaign's artwork is not served to the public alongside its `isActive: false`.
 */
router.get('/', getPromoContent);
router.get('/admin', isAuthorized, restrictTo('siteSetting:write'), getPromoAdmin);

router.put(
  '/',
  isAuthorized,
  restrictTo('siteSetting:write'),
  slotUploader(SLOTS),
  handleMulterError,
  validate(updatePromoSchema), // validate body first, before hitting Cloudinary
  uploadSlotsToCloudinary('3mmile/promo', SLOTS),
  updatePromoContent,
);

export default router;
