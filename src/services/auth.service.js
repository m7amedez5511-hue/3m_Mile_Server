import bcrypt from 'bcryptjs';
import { getUserByEmail } from './user.service.js';
import { signJwt } from '../utils/jwt.utils.js';
import { createAppError } from '../utils/createAppError.js';
import { logAudit } from '../utils/auditLogger.js';
// Service for handling user authentication (login, logout, token refresh, etc.)
export const loginUser = async ({ email, password }, req) => {
  //1 check if user exists
  const user = await getUserByEmail(email, false); // need full doc for select('+password')
  if (!user) {
    throw createAppError(401, 'invalid_credentials');
  }

  if (!user.isActive || user.isDeleted) {
    throw createAppError(401, 'account_disabled');
  }
  //2 check if password is correct
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw createAppError(401, 'invalid_credentials');
  }

    //3 check if user is admin
  if (user.role?.name !== 'Admin') {
    throw createAppError(403, 'admin_access_only');
  }
  //4 generate access and refresh tokens
  const accessToken = await signJwt(user._id, 'ACCESS_TOKEN_SECRET', 'user');
  const refreshToken = await signJwt(user._id, 'REFRESH_TOKEN_SECRET', 'user');
  //5 log audit
  const userObj = user.toObject ? user.toObject() : user;
  delete userObj.password;

  logAudit({ userId: user._id, action: 'LOGIN', resource: 'User', details: { email }, ip: req?.ip });
  //6 return user object and tokens
  return { user: userObj, accessToken, refreshToken };
};
