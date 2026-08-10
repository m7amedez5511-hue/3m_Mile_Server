import { Router } from 'express';
import { getRoles, createRole, deleteRole } from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { createRoleSchema } from '../validators/role.validator.js';

const router = Router();

// Admin-only — bootstrapping/inspecting the single system role
router.get('/', isAuthorized, restrictTo('role:write'), getRoles);
router.post('/', isAuthorized, restrictTo('role:write'), validate(createRoleSchema), createRole);
router.delete('/:id', isAuthorized, restrictTo('role:delete'), deleteRole);

export default router;