import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import { loginUser } from '../services/auth.service.js';
// Controller for user login
export const login = asyncHandler(async (req, res) => {
  //1 validate request body and perform login
  const { user, accessToken, refreshToken } = await loginUser(req.body, req);
  //2 send success response with user info and tokens
  return sendResponse(res, 200, 'login_successful', { user, accessToken, refreshToken });
});
// Controller for getting current logged-in user info
export const me = asyncHandler(async (req, res) => {
  //1 send success response with current user info
  return sendResponse(res, 200, 'current_user', req.user);
});
