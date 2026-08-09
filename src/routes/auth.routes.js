import { Router } from 'express';
import {  login, me } from '../controllers/index.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../validators/auth.validator.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';
const router = Router();

// No public sign-up: the dashboard is Admin-only, so only an already
// logged-in admin can create another admin account.

router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/me', isAuthorized, me);

export default router;