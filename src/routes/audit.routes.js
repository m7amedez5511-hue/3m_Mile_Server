import { Router } from 'express';
import { getAuditLogs } from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';

const router = Router();

router.get('/', isAuthorized, getAuditLogs);

export default router;
//restrictTo('audit:read')