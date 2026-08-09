import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listUsers,
  getUserProfile,
  updateUser as updateUserService,
  deleteUser as deleteUserService,
} from '../services/user.service.js';

export const getUsers = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await listUsers({ page: Number(page) || 1, limit: Number(limit) || 10 });
  return sendResponse(res, 200, 'users_fetched', result);
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await getUserProfile(req.params.id);
  return sendResponse(res, 200, 'user_fetched', user);
});

export const updateUserById = asyncHandler(async (req, res) => {
  const user = await updateUserService(req.params.id, req.body);
  return sendResponse(res, 200, 'user_updated', user);
});

export const deleteUserById = asyncHandler(async (req, res) => {
  await deleteUserService(req.params.id);
  return sendResponse(res, 200, 'user_deleted', null);
});