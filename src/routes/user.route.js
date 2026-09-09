import { Router } from 'express';
import { getUsers, getUserById, updateUserById, deleteUserById } from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { updateUserSchema } from '../validators/user.validator.js';

const router = Router();

router.get('/', isAuthorized, restrictTo('user:read'), getUsers);
router.get('/:id', isAuthorized, restrictTo('user:read'), getUserById);
router.put('/:id', isAuthorized, restrictTo('user:write'), validate(updateUserSchema), updateUserById);
router.delete('/:id', isAuthorized, restrictTo('user:delete'), deleteUserById);

export default router;