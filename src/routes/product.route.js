import { Router } from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { uploaders, uploadToCloudinary, handleMulterError } from '../utils/multer.js';
import { createProductSchema, updateProductSchema } from '../validators/product.validator.js';

const router = Router();

// Public reads
router.get('/', getProducts);
router.get('/:id', getProduct);

// Admin-only writes
router.post(
  '/',
  isAuthorized,
  restrictTo('product:write'),
  uploaders.productImages.array('images', 8),
  handleMulterError,
  uploadToCloudinary('3mmile/products'),
  validate(createProductSchema),
  createProduct,
);

router.put(
  '/:id',
  isAuthorized,
  restrictTo('product:write'),
  uploaders.productImages.array('images', 8),
  handleMulterError,
  uploadToCloudinary('3mmile/products'),
  validate(updateProductSchema),
  updateProduct,
);

router.delete('/:id', isAuthorized, restrictTo('product:delete'), deleteProduct);

export default router;
