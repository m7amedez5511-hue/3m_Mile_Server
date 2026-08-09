import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listBranches,
  getBranchById,
  createBranch as createBranchService,
  updateBranch as updateBranchService,
  deleteBranch as deleteBranchService,
} from '../services/branch.service.js';
// Controller for fetching a paginated list of branches
export const getBranches = asyncHandler(async (req, res) => {
  //1 extract pagination and filter parameters from query
  const { page, limit, city } = req.query;
  //2 call the service to get the list of branches with pagination and optional city filter
  const result = await listBranches({ page: Number(page) || 1, limit: Number(limit) || 10, city });
  //3 send success response with the paginated list of branches
  return sendResponse(res, 200, 'branches_fetched', result);
});
// Controller for fetching a single branch by ID
export const getBranch = asyncHandler(async (req, res) => {
  //1 call the service to get the branch by ID
  const branch = await getBranchById(req.params.id);
  //2 send success response with the fetched branch
  return sendResponse(res, 200, 'branch_fetched', branch);
});
// Controller for creating a new branch
export const createBranch = asyncHandler(async (req, res) => {
  //1 call the service to create a new branch with the request data
  const branch = await createBranchService(req);
  //2 send success response with the created branch
  return sendResponse(res, 201, 'branch_created', branch);
});
// Controller for updating an existing branch by ID
export const updateBranch = asyncHandler(async (req, res) => {
  //1 call the service to update the branch with the request data
  const branch = await updateBranchService(req.params.id, req);
  //2 send success response with the updated branch
  return sendResponse(res, 200, 'branch_updated', branch);
});
// Controller for deleting a branch by ID
export const deleteBranch = asyncHandler(async (req, res) => {
  //1 call the service to delete the branch by ID
  await deleteBranchService(req.params.id, req);
  //2 send success response indicating the branch was deleted
  return sendResponse(res, 200, 'branch_deleted', null);
});
