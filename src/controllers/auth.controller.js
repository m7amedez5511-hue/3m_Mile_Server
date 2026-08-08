import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import { registerUser, loginUser } from '../services/auth.service.js';

export const register = asyncHandler(async (req, res) => {
  const user = await registerUser(req.body);
  return sendResponse(res, 201, 'user_registered_successfully', user);
});

export const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await loginUser(req.body);
  return sendResponse(res, 200, 'login_successful', { user, accessToken, refreshToken });
});

export const me = asyncHandler(async (req, res) => {
  return sendResponse(res, 200, 'current_user', req.user);
});