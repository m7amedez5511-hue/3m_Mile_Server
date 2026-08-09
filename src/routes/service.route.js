import { Router } from 'express';
import {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
} from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { uploaders, uploadToCloudinary, handleMulterError } from '../utils/multer.js';
import { createServiceSchema, updateServiceSchema } from '../validators/service.validator.js';

const router = Router();

// Public reads
router.get('/', getServices);
router.get('/:id', getService);

// Admin-only writes
router.post(
  '/',
  isAuthorized,
  restrictTo('service:write'),
  uploaders.productImage.single('image'),
  handleMulterError,
  uploadToCloudinary('3mmile/services'),
  validate(createServiceSchema),
  createService,
);

router.put(
  '/:id',
  isAuthorized,
  restrictTo('service:write'),
  uploaders.productImage.single('image'),
  handleMulterError,
  uploadToCloudinary('3mmile/services'),
  validate(updateServiceSchema),
  updateService,
);

// Separate endpoint for the work gallery attached to a service
router.put(
  '/:id/gallery',
  isAuthorized,
  restrictTo('service:write'),
  uploaders.productImages.array('images', 10),
  handleMulterError,
  uploadToCloudinary('3mmile/services/gallery'),
  updateService,
);

router.delete('/:id', isAuthorized, restrictTo('service:delete'), deleteService);

export default router;
