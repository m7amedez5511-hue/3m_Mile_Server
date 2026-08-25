import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listWarrantyGroups,
  getWarrantyGroupById,
  createWarrantyGroup as createWarrantyGroupService,
  updateWarrantyGroup as updateWarrantyGroupService,
  deleteWarrantyGroup as deleteWarrantyGroupService,
} from '../services/warrantyGroup.service.js';

// Controller for fetching the list of warranty groups
export const getWarrantyGroups = asyncHandler(async (req, res) => {
  //1 extract pagination and filter parameters from query
  const { page, limit, isActive } = req.query;
  //2 call the service to get the list
  const result = await listWarrantyGroups({
    page: Number(page) || 1,
    limit: Number(limit) || 50,
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
  });
  //3 send success response with the list
  return sendResponse(res, 200, 'warranty_groups_fetched', result);
});

// Controller for fetching a single warranty group by ID
export const getWarrantyGroup = asyncHandler(async (req, res) => {
  //1 call the service to get the group by ID
  const group = await getWarrantyGroupById(req.params.id);
  //2 send success response with the fetched group
  return sendResponse(res, 200, 'warranty_group_fetched', group);
});

// Controller for creating a new warranty group
export const createWarrantyGroup = asyncHandler(async (req, res) => {
  //1 call the service to create the group
  const group = await createWarrantyGroupService(req);
  //2 send success response with the created group
  return sendResponse(res, 201, 'warranty_group_created', group);
});

// Controller for updating an existing warranty group by ID
export const updateWarrantyGroup = asyncHandler(async (req, res) => {
  //1 call the service to update the group
  const group = await updateWarrantyGroupService(req.params.id, req);
  //2 send success response with the updated group
  return sendResponse(res, 200, 'warranty_group_updated', group);
});

// Controller for deleting a warranty group by ID
export const deleteWarrantyGroup = asyncHandler(async (req, res) => {
  //1 call the service to delete the group
  await deleteWarrantyGroupService(req.params.id, req);
  //2 send success response indicating the group was deleted
  return sendResponse(res, 200, 'warranty_group_deleted', null);
});
