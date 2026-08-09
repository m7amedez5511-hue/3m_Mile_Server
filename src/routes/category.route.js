import { Router } from 'express';
import {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { uploaders, uploadToCloudinary, handleMulterError } from '../utils/multer.js';
import { createCategorySchema, updateCategorySchema } from '../validators/category.validator.js';

const router = Router();

// Public reads
router.get('/', getCategories);
router.get('/:id', getCategory);

// Admin-only writes (permissions match scripts/seed.js: category:write / category:delete)
router.post(
  '/',
  isAuthorized,
  restrictTo('category:write'),
  uploaders.categoryImage.single('image'),
  handleMulterError,
  uploadToCloudinary('3mmile/categories'),
  validate(createCategorySchema),
  createCategory,
);

router.put(
  '/:id',
  isAuthorized,
  restrictTo('category:write'),
  uploaders.categoryImage.single('image'),
  handleMulterError,
  uploadToCloudinary('3mmile/categories'),
  validate(updateCategorySchema),
  updateCategory,
);

router.delete('/:id', isAuthorized, restrictTo('category:delete'), deleteCategory);

export default router;