import userModel from "../DB/models/user.model.js";


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