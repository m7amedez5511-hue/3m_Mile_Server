import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listPartners,
  getPartnerById,
  createPartner as createPartnerService,
  updatePartner as updatePartnerService,
  deletePartner as deletePartnerService,
} from '../services/partner.service.js';

export const getPartners = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await listPartners({ page: Number(page) || 1, limit: Number(limit) || 50 });
  return sendResponse(res, 200, 'partners_fetched', result);
});

export const getPartner = asyncHandler(async (req, res) => {
  const partner = await getPartnerById(req.params.id);
  return sendResponse(res, 200, 'partner_fetched', partner);
});

export const createPartner = asyncHandler(async (req, res) => {
  const partner = await createPartnerService(req);
  return sendResponse(res, 201, 'partner_created', partner);
});

export const updatePartner = asyncHandler(async (req, res) => {
  const partner = await updatePartnerService(req.params.id, req);
  return sendResponse(res, 200, 'partner_updated', partner);
});

export const deletePartner = asyncHandler(async (req, res) => {
  await deletePartnerService(req.params.id, req);
  return sendResponse(res, 200, 'partner_deleted', null);
});
