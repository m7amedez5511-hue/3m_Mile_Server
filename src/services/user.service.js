import bcrypt from 'bcryptjs';
import userModel from "../DB/models/user.model.js";
import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';

const userCrud = crudService('User');

/**
 * Fetch a user by id.
 * @param {string} id
 * @param {boolean} lean - return a plain object instead of a Mongoose document
 */
export const getUser = async (id, lean = true) => {
  const query = userModel.findById(id).populate('role');
  return lean ? query.lean() : query;
};

export const getUserByEmail = async (email, lean = true) => {
  const query = userModel.findOne({ email: email.toLowerCase().trim() }).select('+password').populate('role');
  return lean ? query.lean() : query;
};

export const createUser = async (data) => {
  const user = await userModel.create(data);
  return user.toObject();
};

export const listUsers = async ({ page = 1, limit = 10 } = {}) => {
  return userCrud.findAndCountAll(
    { isDeleted: false },
    { page, limit, sort: { createdAt: -1 }, select: '-password', populate: [{ path: 'role' }] },
  );
};

export const getUserProfile = async (id) => {
  const user = await getUser(id, true);
  if (!user || user.isDeleted) {
    throw createAppError(404, 'user_not_found');
  }
  return user;
};

export const updateUser = async (id, updateData) => {
  const existing = await userCrud.findByPk(id);
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'user_not_found');
  }

  const data = { ...updateData };
  if (data.password) {
    data.password = await bcrypt.hash(data.password, 12);
    data.passwordChangedAt = new Date();
  }

  const updated = await userCrud.findOneAndUpdate({ _id: id }, data);
  if (updated) delete updated.password;
  return updated;
};

export const deleteUser = async (id) => {
  const existing = await userCrud.findByPk(id);
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'user_not_found');
  }
  // Never allow the sole System Administrator account to be removed.
  const adminUserCount = await userCrud.count({ isDeleted: false });
  if (adminUserCount <= 1) {
    throw createAppError(403, 'cannot_delete_last_admin_user');
  }
  return userCrud.softDelete({ _id: id });
};