import { Router } from 'express';
import {
  getPartners,
  getPartner,
  createPartner,
  updatePartner,
  deletePartner,
} from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { uploaders, uploadToCloudinary, handleMulterError } from '../utils/multer.js';
import { createPartnerSchema, updatePartnerSchema } from '../validators/partner.validator.js';

const router = Router();

// Public reads
router.get('/', getPartners);
router.get('/:id', getPartner);

// Admin-only writes
router.post(
  '/',
  isAuthorized,
  restrictTo('partner:write'),
  uploaders.categoryImage.single('logo'),
  handleMulterError,
  validate(createPartnerSchema), // validate body first, before hitting Cloudinary
  uploadToCloudinary('3mmile/partners'),
  createPartner,
);

router.put(
  '/:id',
  isAuthorized,
  restrictTo('partner:write'),
  uploaders.categoryImage.single('logo'),
  handleMulterError,
  validate(updatePartnerSchema), // validate body first, before hitting Cloudinary
  uploadToCloudinary('3mmile/partners'),
  updatePartner,
);

router.delete('/:id', isAuthorized, restrictTo('partner:delete'), deletePartner);

export default router;