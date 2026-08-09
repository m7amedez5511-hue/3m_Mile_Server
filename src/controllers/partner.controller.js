import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listPartners,
  getPartnerById,
  createPartner as createPartnerService,
  updatePartner as updatePartnerService,
  deletePartner as deletePartnerService,
} from '../services/partner.service.js';

// Controller for fetching a paginated list of partners
export const getPartners = asyncHandler(async (req, res) => {
  //1 extract pagination parameters from query
  const { page, limit } = req.query;
  //2 call the service to get the list of partners with pagination
  const result = await listPartners({ page: Number(page) || 1, limit: Number(limit) || 50 });
  //3 send success response with the paginated list of partners
  return sendResponse(res, 200, 'partners_fetched', result);
});

// Controller for fetching a single partner by ID
export const getPartner = asyncHandler(async (req, res) => {
  //1 call the service to get the partner by ID
  const partner = await getPartnerById(req.params.id);
  //2 send success response with the fetched partner
  return sendResponse(res, 200, 'partner_fetched', partner);
});

// Controller for creating a new partner
export const createPartner = asyncHandler(async (req, res) => {
  //1 call the service to create a new partner with the request data
  const partner = await createPartnerService(req);
  //2 send success response with the created partner
  return sendResponse(res, 201, 'partner_created', partner);
});

// Controller for updating an existing partner by ID
export const updatePartner = asyncHandler(async (req, res) => {
  //1 call the service to update the partner with the request data
  const partner = await updatePartnerService(req.params.id, req);
  //2 send success response with the updated partner
  return sendResponse(res, 200, 'partner_updated', partner);
});

// Controller for deleting a partner by ID
export const deletePartner = asyncHandler(async (req, res) => {
  //1 call the service to delete the partner by ID
  await deletePartnerService(req.params.id, req);
  //2 send success response indicating the partner was deleted
  return sendResponse(res, 200, 'partner_deleted', null);
});