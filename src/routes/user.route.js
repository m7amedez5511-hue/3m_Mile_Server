import { Router } from 'express';
import { getUsers, getUserById, updateUserById, deleteUserById } from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { updateUserSchema } from '../validators/user.validator.js';

const router = Router();

router.get('/', isAuthorized, getUsers);
router.get('/:id', isAuthorized, getUserById);
router.put('/:id', isAuthorized, validate(updateUserSchema), updateUserById);
router.delete('/:id', isAuthorized, deleteUserById);

export default router;