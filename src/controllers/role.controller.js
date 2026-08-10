import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listRoles,
  createRole as createRoleService,
  deleteRole as deleteRoleService,
} from '../services/role.service.js';

export const getRoles = asyncHandler(async (req, res) => {
  const roles = await listRoles();
  return sendResponse(res, 200, 'roles_fetched', roles);
});

export const createRole = asyncHandler(async (req, res) => {
  const role = await createRoleService(req);
  return sendResponse(res, 201, 'role_created', role);
});

export const deleteRole = asyncHandler(async (req, res) => {
  await deleteRoleService(req.params.id, req);
  return sendResponse(res, 200, 'role_deleted', null);
});