import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockCrud = {
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
  findOneAndUpdate: jest.fn(),
  count: jest.fn(),
  softDelete: jest.fn(),
};
const mockUserModel = { findById: jest.fn(), findOne: jest.fn(), create: jest.fn() };
const mockHash = jest.fn();
const mockCompare = jest.fn();

jest.unstable_mockModule('../../services/crud.service.js', () => ({ default: () => mockCrud }));
jest.unstable_mockModule('../../DB/models/user.model.js', () => ({ default: mockUserModel }));
jest.unstable_mockModule('bcryptjs', () => ({ default: { hash: mockHash, compare: mockCompare } }));

const {
  getUser, getUserByEmail, createUser, listUsers, getUserProfile, updateUser, deleteUser,
} = await import('../../services/user.service.js');

const USER_ID = '64a1f0c2e4b0a1b2c3d4e5f6';

// Chainable fake Mongoose query: populate()/select() return the query, lean() resolves `result`
const makeQuery = (result) => {
  const query = { populate: jest.fn(), select: jest.fn(), lean: jest.fn() };
  query.populate.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.lean.mockResolvedValue(result);
  return query;
};

describe('Users — getUser', () => {
  // 1. Default (lean) lookup populates role and returns a plain object
  it('should findById, populate role and return the lean result by default', async () => {
    const query = makeQuery({ _id: USER_ID });
    mockUserModel.findById.mockReturnValue(query);

    const result = await getUser(USER_ID);

    expect(mockUserModel.findById).toHaveBeenCalledWith(USER_ID);
    expect(query.populate).toHaveBeenCalledWith('role');
    expect(query.lean).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ _id: USER_ID });
  });

  // 2. lean=false returns the query (full document) without calling lean()
  it('should return the query itself when lean is false', async () => {
    const query = makeQuery(null);
    mockUserModel.findById.mockReturnValue(query);

    const result = await getUser(USER_ID, false);

    expect(query.lean).not.toHaveBeenCalled();
    expect(result).toBe(query);
  });
});

describe('Users — getUserByEmail', () => {
  // 1. Email is normalised and the hidden password field is selected
  it('should lowercase/trim the email, select +password and populate role', async () => {
    const query = makeQuery({ _id: USER_ID, password: 'h' });
    mockUserModel.findOne.mockReturnValue(query);

    const result = await getUserByEmail('  Admin@3MMile.COM ');

    expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'admin@3mmile.com' });
    expect(query.select).toHaveBeenCalledWith('+password');
    expect(query.populate).toHaveBeenCalledWith('role');
    expect(result).toEqual({ _id: USER_ID, password: 'h' });
  });

  // 2. lean=false skips lean()
  it('should skip lean() when lean is false', async () => {
    const query = makeQuery(null);
    mockUserModel.findOne.mockReturnValue(query);

    const result = await getUserByEmail('a@b.co', false);

    expect(query.lean).not.toHaveBeenCalled();
    expect(result).toBe(query);
  });
});

describe('Users — createUser', () => {
  // 1. Creates via the model and returns a plain object
  it('should create the user and return toObject()', async () => {
    const plain = { _id: USER_ID, email: 'a@b.co' };
    mockUserModel.create.mockResolvedValue({ toObject: () => plain });

    const result = await createUser({ email: 'a@b.co', password: 'p' });

    expect(mockUserModel.create).toHaveBeenCalledWith({ email: 'a@b.co', password: 'p' });
    expect(result).toEqual(plain);
  });
});

describe('Users — listUsers', () => {
  // 1. Defaults: non-deleted, newest first, password excluded, role populated
  it('should list non-deleted users with defaults and no password', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listUsers();

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith(
      { isDeleted: false },
      { page: 1, limit: 10, sort: { createdAt: -1 }, select: '-password', populate: [{ path: 'role' }] },
    );
  });

  // 2. Pagination values are forwarded
  it('should forward page and limit', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listUsers({ page: 2, limit: 50 });

    expect(mockCrud.findAndCountAll.mock.calls[0][1]).toMatchObject({ page: 2, limit: 50 });
  });
});

describe('Users — getUserProfile', () => {
  // 1. Found, non-deleted user is returned
  it('should return the lean user when found', async () => {
    const user = { _id: USER_ID, isDeleted: false };
    mockUserModel.findById.mockReturnValue(makeQuery(user));

    await expect(getUserProfile(USER_ID)).resolves.toEqual(user);
  });

  // 2. Missing user → 404 user_not_found
  it('should throw 404 user_not_found when nothing matches', async () => {
    mockUserModel.findById.mockReturnValue(makeQuery(null));

    await expect(getUserProfile(USER_ID)).rejects.toMatchObject({ status: 404, code: 'user_not_found' });
  });

  // 3. Soft-deleted user → 404 user_not_found
  it('should throw 404 user_not_found when the user is soft-deleted', async () => {
    mockUserModel.findById.mockReturnValue(makeQuery({ _id: USER_ID, isDeleted: true }));

    await expect(getUserProfile(USER_ID)).rejects.toMatchObject({ status: 404, code: 'user_not_found' });
  });
});

describe('Users — updateUser', () => {
  const existing = { _id: USER_ID, isDeleted: false };

  // 1. Plain fields are forwarded untouched and no hashing happens
  it('should update the given fields without hashing when no password is provided', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue({ _id: USER_ID, fullName: 'New' });

    const result = await updateUser(USER_ID, { fullName: 'New', isActive: false });

    expect(mockCrud.findByPk).toHaveBeenCalledWith(USER_ID);
    expect(mockHash).not.toHaveBeenCalled();
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: USER_ID }, { fullName: 'New', isActive: false });
    expect(result).toEqual({ _id: USER_ID, fullName: 'New' });
  });

  // 2. Password is hashed with cost 12 and passwordChangedAt is stamped
  it('should hash the password with 12 rounds and set passwordChangedAt', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockHash.mockResolvedValue('hashed-pw');
    mockCrud.findOneAndUpdate.mockResolvedValue({ _id: USER_ID });

    await updateUser(USER_ID, { password: 'plaintext' });

    expect(mockHash).toHaveBeenCalledWith('plaintext', 12);
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: USER_ID },
      { password: 'hashed-pw', passwordChangedAt: expect.any(Date) },
    );
  });

  // 3. The input object is not mutated
  it('should not mutate the caller-supplied updateData', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockHash.mockResolvedValue('hashed');
    mockCrud.findOneAndUpdate.mockResolvedValue({});
    const input = { password: 'plain' };

    await updateUser(USER_ID, input);

    expect(input).toEqual({ password: 'plain' });
  });

  // 4. Password is stripped from the returned document
  it('should strip password from the returned document', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue({ _id: USER_ID, password: 'leak', fullName: 'X' });

    const result = await updateUser(USER_ID, { fullName: 'X' });

    expect(result).toEqual({ _id: USER_ID, fullName: 'X' });
  });

  // 5. A null update result is returned as-is
  it('should return null when findOneAndUpdate yields nothing', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(null);

    await expect(updateUser(USER_ID, { fullName: 'X' })).resolves.toBeNull();
  });

  // 6. Missing / deleted user → 404 and no write
  it('should throw 404 user_not_found and not write when the user is missing or deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...existing, isDeleted: true });

    await expect(updateUser(USER_ID, { fullName: 'x' })).rejects.toMatchObject({ status: 404, code: 'user_not_found' });
    await expect(updateUser(USER_ID, { fullName: 'x' })).rejects.toMatchObject({ status: 404, code: 'user_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('Users — deleteUser', () => {
  // 1. Soft-deletes when more than one active user remains
  it('should soft-delete the user when other active users exist', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: USER_ID, isDeleted: false });
    mockCrud.count.mockResolvedValue(2);
    mockCrud.softDelete.mockResolvedValue({ deletedCount: 1, acknowledged: true });

    const result = await deleteUser(USER_ID);

    expect(mockCrud.count).toHaveBeenCalledWith({ isDeleted: false });
    expect(mockCrud.softDelete).toHaveBeenCalledWith({ _id: USER_ID });
    expect(result).toEqual({ deletedCount: 1, acknowledged: true });
  });

  // 2. Missing / already-deleted user → 404
  it('should throw 404 user_not_found when the user is missing or already deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: USER_ID, isDeleted: true });

    await expect(deleteUser(USER_ID)).rejects.toMatchObject({ status: 404, code: 'user_not_found' });
    await expect(deleteUser(USER_ID)).rejects.toMatchObject({ status: 404, code: 'user_not_found' });
    expect(mockCrud.count).not.toHaveBeenCalled();
    expect(mockCrud.softDelete).not.toHaveBeenCalled();
  });

  // 3. The last remaining user can never be deleted → 403
  it('should throw 403 cannot_delete_last_admin_user when only one active user remains', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: USER_ID, isDeleted: false });
    mockCrud.count.mockResolvedValue(1);

    await expect(deleteUser(USER_ID)).rejects.toMatchObject({ status: 403, code: 'cannot_delete_last_admin_user' });
    expect(mockCrud.softDelete).not.toHaveBeenCalled();
  });

  // 4. A zero count (defensive) is also blocked
  it('should throw 403 when the active user count is 0', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: USER_ID, isDeleted: false });
    mockCrud.count.mockResolvedValue(0);

    await expect(deleteUser(USER_ID)).rejects.toMatchObject({ status: 403, code: 'cannot_delete_last_admin_user' });
  });
});
