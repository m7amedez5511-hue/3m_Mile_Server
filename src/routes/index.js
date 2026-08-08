import { Router } from 'express';
import authRoutes from './auth.routes.js';
import auditRoutes from './audit.routes.js';

const router = Router();

// Health check (matched by nginx location /api/health)
router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'ok', responseAt: new Date() });
});

router.use('/v1/auth', authRoutes);
router.use('/v1/audit', auditRoutes);

export default router;