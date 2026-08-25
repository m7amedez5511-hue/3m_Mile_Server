import { Router } from 'express';
import {
  getServices,
  getService,
  getServiceBySlugHandler,
  createService,
  updateService,
  deleteService,
} from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { uploaders, uploadToCloudinary, handleMulterError } from '../utils/multer.js';
import { slotUploader, uploadSlotsToCloudinary, SERVICE_SLOTS } from '../utils/slotUpload.js';
import { createServiceSchema, updateServiceSchema } from '../validators/service.validator.js';

const router = Router();

// Public reads.
// `/slug/:slug` is declared before `/:id` for readability; the two cannot collide
// anyway because one is two path segments and the other is one.
router.get('/', getServices);
router.get('/slug/:slug', getServiceBySlugHandler);
router.get('/:id', getService);

// Admin-only writes.
// Images arrive as named slots (heroImage/wideImage/gridImage/collage) so each one
// lands in a known layout container — see utils/slotUpload.js.
router.post(
  '/',
  isAuthorized,
  restrictTo('service:write'),
  slotUploader(SERVICE_SLOTS),
  handleMulterError,
  validate(createServiceSchema), // validate body first, before hitting Cloudinary
  uploadSlotsToCloudinary('3mmile/services', SERVICE_SLOTS),
  createService,
);

router.put(
  '/:id',
  isAuthorized,
  restrictTo('service:write'),
  slotUploader(SERVICE_SLOTS),
  handleMulterError,
  validate(updateServiceSchema), // validate body first, before hitting Cloudinary
  uploadSlotsToCloudinary('3mmile/services', SERVICE_SLOTS),
  updateService,
);

/**
 * Legacy work-gallery endpoint. Superseded by the named slots above and by the
 * GalleryItem collection (which can tag items to a service), but retained because it is
 * a documented endpoint and removing it would break any existing consumer.
 */
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
