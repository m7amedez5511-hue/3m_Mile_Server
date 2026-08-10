import { Router } from 'express';
import authRoutes from './auth.routes.js';
import auditRoutes from './audit.routes.js';
import categoryRoutes from './category.route.js';
import userRoutes from './user.route.js';
import serviceRoutes from './service.route.js';
import productRoutes from './product.route.js';
import branchRoutes from './branch.route.js';
import blogPostRoutes from './blogPost.route.js';
import packageRoutes from './package.route.js';
import galleryRoutes from './galleryItem.route.js';
import partnerRoutes from './partner.route.js';
import faqRoutes from './faq.route.js';
import siteSettingRoutes from './siteSetting.route.js';
import roleRoutes from './role.route.js';
const router = Router();

// Health check (matched by nginx location /api/health)
router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'ok', responseAt: new Date() });
});

router.use('/auth', authRoutes);
router.use('/audit', auditRoutes);
router.use('/categories', categoryRoutes);
router.use('/users', userRoutes);
router.use('/services', serviceRoutes);
router.use('/products', productRoutes);
router.use('/branches', branchRoutes);
router.use('/blog-posts', blogPostRoutes);
router.use('/packages', packageRoutes);
router.use('/gallery', galleryRoutes);
router.use('/partners', partnerRoutes);
router.use('/faqs', faqRoutes);
router.use('/settings', siteSettingRoutes);
router.use('/roles', roleRoutes);
export default router;
