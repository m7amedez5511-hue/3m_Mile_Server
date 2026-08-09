import { Router } from 'express';
import { register, login, me } from '../controllers/index.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';
const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', isAuthorized, me);

export default router;