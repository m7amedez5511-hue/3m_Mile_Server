import { Router } from 'express';
import { getAuditLogs, getAuditLog } from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';

const router = Router();

router.get('/', isAuthorized ,restrictTo('audit:read'), getAuditLogs);
router.get('/:id', isAuthorized, restrictTo('audit:read'), getAuditLog);

export default router;
