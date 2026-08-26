import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listServices,
  getServiceById,
  getServiceBySlug,
  createService as createServiceService,
  updateService as updateServiceService,
  deleteService as deleteServiceService,
} from '../services/service.service.js';

// Controller for fetching a paginated list of services
export const getServices = asyncHandler(async (req, res) => {
  //1 extract pagination and filter parameters from query
  const { page, limit, search, category, isFeatured, isActive } = req.query;
  //2 call the service to get the list of services with pagination and optional filters
  const result = await listServices({
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    search,
    category,
    isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
  });
  //3 send success response with the paginated list of services
  return sendResponse(res, 200, 'services_fetched', result);
});

// Controller for fetching a single service by slug — the public site's lookup path
export const getServiceBySlugHandler = asyncHandler(async (req, res) => {
  //1 call the service to get the service by slug
  const service = await getServiceBySlug(req.params.slug);
  //2 send success response with the fetched service
  return sendResponse(res, 200, 'service_fetched', service);
});

// Controller for fetching a single service by ID
export const getService = asyncHandler(async (req, res) => {
  //1 call the service to get the service by ID
  const service = await getServiceById(req.params.id);
  //2 send success response with the fetched service
  return sendResponse(res, 200, 'service_fetched', service);
});

// Controller for creating a new service
export const createService = asyncHandler(async (req, res) => {
  //1 call the service to create a new service with the request data
  const service = await createServiceService(req);
  //2 send success response with the created service
  return sendResponse(res, 201, 'service_created', service);
});

// Controller for updating an existing service by ID — handles both the
// main metadata/image update and the separate gallery-only update route
export const updateService = asyncHandler(async (req, res) => {
  //1 call the service to update the service with the request data
  const service = await updateServiceService(req.params.id, req);
  //2 send success response with the updated service
  return sendResponse(res, 200, 'service_updated', service);
});

// Controller for deleting a service by ID
export const deleteService = asyncHandler(async (req, res) => {
  //1 call the service to delete the service by ID
  await deleteServiceService(req.params.id, req);
  //2 send success response indicating the service was deleted
  return sendResponse(res, 200, 'service_deleted', null);
});