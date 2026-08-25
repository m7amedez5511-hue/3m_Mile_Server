import { Router } from 'express';
import {
  getWarrantyGroups,
  getWarrantyGroup,
  createWarrantyGroup,
  updateWarrantyGroup,
  deleteWarrantyGroup,
} from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  createWarrantyGroupSchema,
  updateWarrantyGroupSchema,
} from '../validators/warrantyGroup.validator.js';

const router = Router();

// Public reads — the warranty page renders every active group as a tab.
router.get('/', getWarrantyGroups);
router.get('/:id', getWarrantyGroup);

// Admin-only writes. No upload middleware: warranty content is entirely text, so the
// body is plain JSON and `tiers` arrives as a nested array rather than a JSON string.
router.post(
  '/',
  isAuthorized,
  restrictTo('siteSetting:write'),
  validate(createWarrantyGroupSchema),
  createWarrantyGroup,
);

router.put(
  '/:id',
  isAuthorized,
  restrictTo('siteSetting:write'),
  validate(updateWarrantyGroupSchema),
  updateWarrantyGroup,
);

router.delete('/:id', isAuthorized, restrictTo('siteSetting:delete'), deleteWarrantyGroup);

export default router;
