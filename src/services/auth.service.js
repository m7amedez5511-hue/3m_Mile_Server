import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { getUserByEmail, getUser } from './user.service.js';
import { signJwt, verifyJwt } from '../utils/jwt.utils.js';
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

// Exchange a still-valid refresh token for a brand-new access token, so a long
// admin session survives the short-lived access token without forcing a
// re-login. Mirrors the checks auth.middleware.js applies to access tokens.
export const refreshAccessToken = async ({ refreshToken }) => {
  // verify against the REFRESH secret — an access token fails here because it
  //  was signed with the (different) access secret
  const { decodedToken, expired, valid } = await verifyJwt(refreshToken, 'REFRESH_TOKEN_SECRET');
  if (!valid || expired || !decodedToken || !mongoose.isValidObjectId(decodedToken.aud)) {
    throw createAppError(401, 'invalid_token');
  }

  // the user must still exist and be usable
  const user = await getUser(decodedToken.aud, true);
  if (!user || user.isDeleted || !user.isActive) {
    throw createAppError(401, 'invalid_token');
  }

  // a password change revokes every token minted before it — the same rule
  //  auth.middleware.js applies to access tokens. Without this, a stolen refresh
  //  token survives the one revocation mechanism the codebase has.
  if (user.passwordChangedAt) {
    const passwordChangedAtTimestamp = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
    if (passwordChangedAtTimestamp > decodedToken.iat) {
      throw createAppError(401, 'invalid_token');
    }
  }

  // the dashboard is admin-only: loginUser refuses a non-Admin role, so a refresh must
  //  too — otherwise a demoted admin's refresh token keeps minting access tokens for its
  //  30-day life (found in the fix-wave-1 review).
  if (user.role?.name !== 'Admin') {
    throw createAppError(401, 'invalid_token');
  }

  return { accessToken: await signJwt(user._id, 'ACCESS_TOKEN_SECRET', 'user') };
};
