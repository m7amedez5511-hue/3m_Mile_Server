import { Router } from 'express';
import {
  getPackages,
  getPackage,
  createPackage,
  updatePackage,
  deletePackage,
  getPackageBySlugHandler
} from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { uploaders, uploadToCloudinary, handleMulterError } from '../utils/multer.js';
import { createPackageSchema, updatePackageSchema } from '../validators/package.validator.js';

const router = Router();

// Public reads
router.get('/', getPackages);
router.get('/slug/:slug', getPackageBySlugHandler);
router.get('/:id', getPackage);

// Admin-only writes
router.post(
  '/',
  isAuthorized,
  restrictTo('package:write'),
  uploaders.bannerImage.single('image'),
  handleMulterError,
  validate(createPackageSchema), // validate body first, before hitting Cloudinary
  uploadToCloudinary('3mmile/packages'),
  createPackage,
);

router.put(
  '/:id',
  isAuthorized,
  restrictTo('package:write'),
  uploaders.bannerImage.single('image'),
  handleMulterError,
  validate(updatePackageSchema), // validate body first, before hitting Cloudinary
  uploadToCloudinary('3mmile/packages'),
  updatePackage,
);

router.delete('/:id', isAuthorized, restrictTo('package:delete'), deletePackage);

export default router;