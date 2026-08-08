import bcrypt from 'bcryptjs';
import { getUserByEmail, createUser } from './user.service.js';
import { signJwt } from '../utils/jwt.utils.js';
import { createAppError } from '../utils/createAppError.js';

export const registerUser = async ({ fullName, email, password, role }) => {
  const existing = await getUserByEmail(email);
  if (existing) {
    throw createAppError(409, 'email_already_exists');
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await createUser({ fullName, email, password: hashedPassword, role });

  delete user.password;
  return user;
};

export const loginUser = async ({ email, password }) => {
  const user = await getUserByEmail(email, false); // need full doc for select('+password')
  if (!user) {
    throw createAppError(401, 'invalid_credentials');
  }

  if (!user.isActive || user.isDeleted) {
    throw createAppError(401, 'account_disabled');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw createAppError(401, 'invalid_credentials');
  }

  const accessToken = await signJwt(user._id, 'ACCESS_TOKEN_SECRET', 'user');
  const refreshToken = await signJwt(user._id, 'REFRESH_TOKEN_SECRET', 'user');

  const userObj = user.toObject ? user.toObject() : user;
  delete userObj.password;

  return { user: userObj, accessToken, refreshToken };
};