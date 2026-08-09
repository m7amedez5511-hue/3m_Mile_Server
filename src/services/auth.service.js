import bcrypt from 'bcryptjs';
import { getUserByEmail, createUser } from './user.service.js';
import { signJwt } from '../utils/jwt.utils.js';
import { createAppError } from '../utils/createAppError.js';
import crudService from './crud.service.js';

const roleCrud = crudService('Role');


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

  // The dashboard is Admin-only — everything else in the app is public,
  // so any account without the Admin role is rejected here even with
  // correct credentials.
  if (user.role?.name !== 'Admin') {
    throw createAppError(403, 'admin_access_only');
  }

  const accessToken = await signJwt(user._id, 'ACCESS_TOKEN_SECRET', 'user');
  const refreshToken = await signJwt(user._id, 'REFRESH_TOKEN_SECRET', 'user');

  const userObj = user.toObject ? user.toObject() : user;
  delete userObj.password;
  //AUDIT LOG
  const auditCrud = crudService('AuditLog');
  await auditCrud.create({
    user: user._id,
    action: 'LOGIN',
    resource: 'User',
    details: { email },
    ip: req.ip,
  });
  return { user: userObj, accessToken, refreshToken };
};