import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listFaqs,
  getFaqById,
  createFaq as createFaqService,
  updateFaq as updateFaqService,
  deleteFaq as deleteFaqService,
} from '../services/faq.service.js';

export const getFaqs = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await listFaqs({ page: Number(page) || 1, limit: Number(limit) || 50 });
  return sendResponse(res, 200, 'faqs_fetched', result);
});

export const getFaq = asyncHandler(async (req, res) => {
  const faq = await getFaqById(req.params.id);
  return sendResponse(res, 200, 'faq_fetched', faq);
});

export const createFaq = asyncHandler(async (req, res) => {
  const faq = await createFaqService(req);
  return sendResponse(res, 201, 'faq_created', faq);
});

export const updateFaq = asyncHandler(async (req, res) => {
  const faq = await updateFaqService(req.params.id, req);
  return sendResponse(res, 200, 'faq_updated', faq);
});

export const deleteFaq = asyncHandler(async (req, res) => {
  await deleteFaqService(req.params.id, req);
  return sendResponse(res, 200, 'faq_deleted', null);
});
