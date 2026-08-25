import { Router } from 'express';
import { getOffersPageContent, updateOffersPageContent } from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { handleMulterError } from '../utils/multer.js';
import { slotUploader, uploadSlotsToCloudinary } from '../utils/slotUpload.js';
import { updateOffersPageSchema } from '../validators/sections.validator.js';

const router = Router();
const SLOTS = [{ name: 'banner' }];

// Public read — banner and copy for the offers page. The offer cards themselves are
// Package documents, served from /packages.
router.get('/', getOffersPageContent);

router.put(
  '/',
  isAuthorized,
  restrictTo('siteSetting:write'),
  slotUploader(SLOTS),
  handleMulterError,
  validate(updateOffersPageSchema), // validate body first, before hitting Cloudinary
  uploadSlotsToCloudinary('3mmile/offers', SLOTS),
  updateOffersPageContent,
);

export default router;
