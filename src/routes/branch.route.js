import { Router } from 'express';
import {
  getBranches,
  getBranch,
  createBranch,
  updateBranch,
  deleteBranch,
} from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { uploaders, uploadToCloudinary, handleMulterError } from '../utils/multer.js';
import { createBranchSchema, updateBranchSchema } from '../validators/branch.validator.js';

const router = Router();

// Public reads
router.get('/', getBranches);
router.get('/:id', getBranch);

// Admin-only writes
router.post(
  '/',
  isAuthorized,
  restrictTo('branch:write'),
  uploaders.bannerImage.single('image'),
  handleMulterError,
  validate(createBranchSchema), // validate body first, before hitting Cloudinary
  uploadToCloudinary('3mmile/branches'),
  createBranch,
);

router.put(
  '/:id',
  isAuthorized,
  restrictTo('branch:write'),
  uploaders.bannerImage.single('image'),
  handleMulterError,
  validate(updateBranchSchema), // validate body first, before hitting Cloudinary
  uploadToCloudinary('3mmile/branches'),
  updateBranch,
);

router.delete('/:id', isAuthorized, restrictTo('branch:delete'), deleteBranch);

export default router;