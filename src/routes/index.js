import { Router } from 'express';
import authRoutes from './auth.routes.js';
import auditRoutes from './audit.routes.js';
import categoryRoutes from './category.route.js';
import userRoutes from './user.route.js';
import blogPostRoutes from './blogPost.route.js';
const router = Router();

// Health check (matched by nginx location /api/health)
router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'ok', responseAt: new Date() });
});

router.use('/auth', authRoutes);
router.use('/audit', auditRoutes);
router.use('/categories', categoryRoutes);
router.use('/users', userRoutes);
router.use('/blog-posts', blogPostRoutes);
export default router;