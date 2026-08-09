import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listServices,
  getServiceById,
  createService as createServiceService,
  updateService as updateServiceService,
  deleteService as deleteServiceService,
} from '../services/service.service.js';

export const getServices = asyncHandler(async (req, res) => {
  const { page, limit, search, category, isFeatured } = req.query;
  const result = await listServices({
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    search,
    category,
    isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
  });
  return sendResponse(res, 200, 'services_fetched', result);
});

export const getService = asyncHandler(async (req, res) => {
  const service = await getServiceById(req.params.id);
  return sendResponse(res, 200, 'service_fetched', service);
});

export const createService = asyncHandler(async (req, res) => {
  const service = await createServiceService(req);
  return sendResponse(res, 201, 'service_created', service);
});

export const updateService = asyncHandler(async (req, res) => {
  const service = await updateServiceService(req.params.id, req);
  return sendResponse(res, 200, 'service_updated', service);
});

export const deleteService = asyncHandler(async (req, res) => {
  await deleteServiceService(req.params.id, req);
  return sendResponse(res, 200, 'service_deleted', null);
});
