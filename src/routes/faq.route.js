import { Router } from 'express';
import { getFaqs, getFaq, createFaq, updateFaq, deleteFaq } from '../controllers/index.js';
import { isAuthorized } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.js';
import { createFaqSchema, updateFaqSchema } from '../validators/faq.validator.js';

const router = Router();

// Public reads
router.get('/', getFaqs);
router.get('/:id', getFaq);

// Admin-only writes
router.post('/', isAuthorized, restrictTo('faq:write'), validate(createFaqSchema), createFaq);
router.put('/:id', isAuthorized, restrictTo('faq:write'), validate(updateFaqSchema), updateFaq);
router.delete('/:id', isAuthorized, restrictTo('faq:delete'), deleteFaq);

export default router;
