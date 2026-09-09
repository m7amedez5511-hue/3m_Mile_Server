import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockGetUser = jest.fn();
const mockGetUserByEmail = jest.fn();
const mockSignJwt = jest.fn();
const mockVerifyJwt = jest.fn();
const mockCompare = jest.fn();
const mockHash = jest.fn();
const mockLogAudit = jest.fn();

jest.unstable_mockModule('../../services/user.service.js', () => ({ getUser: mockGetUser, getUserByEmail: mockGetUserByEmail }));
jest.unstable_mockModule('../../utils/jwt.utils.js', () => ({ signJwt: mockSignJwt, verifyJwt: mockVerifyJwt }));
jest.unstable_mockModule('bcryptjs', () => ({ default: { compare: mockCompare, hash: mockHash } }));
jest.unstable_mockModule('../../utils/auditLogger.js', () => ({ logAudit: mockLogAudit, actorFromReq: jest.fn() }));

const { loginUser, refreshAccessToken } = await import('../../services/auth.service.js');

const USER_ID = '64a1f0c2e4b0a1b2c3d4e5f6';
const NOW_SEC = Math.floor(Date.now() / 1000);
const mockReq = (extra = {}) => ({ ip: '127.0.0.1', ...extra });
const adminUser = (overrides = {}) => ({
  _id: USER_ID,
  email: 'admin@3mmile.com',
  password: 'hashed',
  isActive: true,
  isDeleted: false,
  role: { name: 'Admin' },
  ...overrides,
});

describe('Auth — loginUser', () => {
  // 1. Happy path: tokens are minted and the sanitized user is returned
  it('should return the user without password plus access and refresh tokens', async () => {
    mockGetUserByEmail.mockResolvedValue(adminUser());
    mockCompare.mockResolvedValue(true);
    mockSignJwt.mockResolvedValueOnce('access.jwt').mockResolvedValueOnce('refresh.jwt');

    const result = await loginUser({ email: 'admin@3mmile.com', password: 'secret' }, mockReq());

    expect(mockGetUserByEmail).toHaveBeenCalledWith('admin@3mmile.com', false);
    expect(mockCompare).toHaveBeenCalledWith('secret', 'hashed');
    expect(mockSignJwt).toHaveBeenNthCalledWith(1, USER_ID, 'ACCESS_TOKEN_SECRET', 'user');
    expect(mockSignJwt).toHaveBeenNthCalledWith(2, USER_ID, 'REFRESH_TOKEN_SECRET', 'user');
    expect(result).toEqual({
      user: { _id: USER_ID, email: 'admin@3mmile.com', isActive: true, isDeleted: false, role: { name: 'Admin' } },
      accessToken: 'access.jwt',
      refreshToken: 'refresh.jwt',
    });
    expect(result.user.password).toBeUndefined();
  });

  // 2. Mongoose documents are converted via toObject() before the password is stripped
  it('should call toObject() on a Mongoose document and strip the password from the copy', async () => {
    const plain = adminUser();
    const doc = { ...plain, toObject: jest.fn(() => ({ ...plain })) };
    mockGetUserByEmail.mockResolvedValue(doc);
    mockCompare.mockResolvedValue(true);
    mockSignJwt.mockResolvedValue('tok');

    const result = await loginUser({ email: plain.email, password: 'x' }, mockReq());

    expect(doc.toObject).toHaveBeenCalledTimes(1);
    expect(result.user.password).toBeUndefined();
    expect(result.user.toObject).toBeUndefined();
    expect(doc.password).toBe('hashed'); // original document untouched
  });

  // 3. Unknown email → 401 invalid_credentials and no password comparison
  it('should throw 401 invalid_credentials when no user matches the email', async () => {
    mockGetUserByEmail.mockResolvedValue(null);

    await expect(loginUser({ email: 'nobody@x.com', password: 'x' }, mockReq()))
      .rejects.toMatchObject({ status: 401, code: 'invalid_credentials' });
    expect(mockCompare).not.toHaveBeenCalled();
    expect(mockSignJwt).not.toHaveBeenCalled();
  });

  // 4. Inactive account → 401 account_disabled (checked BEFORE the password)
  it('should throw 401 account_disabled for an inactive user without comparing the password', async () => {
    mockGetUserByEmail.mockResolvedValue(adminUser({ isActive: false }));

    await expect(loginUser({ email: 'a@x.com', password: 'wrong' }, mockReq()))
      .rejects.toMatchObject({ status: 401, code: 'account_disabled' });
    expect(mockCompare).not.toHaveBeenCalled();
  });

  // 5. Soft-deleted account → 401 account_disabled
  it('should throw 401 account_disabled for a soft-deleted user', async () => {
    mockGetUserByEmail.mockResolvedValue(adminUser({ isDeleted: true }));

    await expect(loginUser({ email: 'a@x.com', password: 'x' }, mockReq()))
      .rejects.toMatchObject({ status: 401, code: 'account_disabled' });
    expect(mockCompare).not.toHaveBeenCalled();
  });

  // 6. Wrong password → 401 invalid_credentials and no tokens
  it('should throw 401 invalid_credentials when the password does not match', async () => {
    mockGetUserByEmail.mockResolvedValue(adminUser());
    mockCompare.mockResolvedValue(false);

    await expect(loginUser({ email: 'a@x.com', password: 'bad' }, mockReq()))
      .rejects.toMatchObject({ status: 401, code: 'invalid_credentials' });
    expect(mockSignJwt).not.toHaveBeenCalled();
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  // 7. Non-admin role → 403 admin_access_only (after a correct password)
  it('should throw 403 admin_access_only when the role is not Admin', async () => {
    mockGetUserByEmail.mockResolvedValue(adminUser({ role: { name: 'Editor' } }));
    mockCompare.mockResolvedValue(true);

    await expect(loginUser({ email: 'a@x.com', password: 'x' }, mockReq()))
      .rejects.toMatchObject({ status: 403, code: 'admin_access_only' });
    expect(mockSignJwt).not.toHaveBeenCalled();
  });

  // 8. Missing role (unpopulated) is treated as non-admin
  it('should throw 403 admin_access_only when the user has no role', async () => {
    mockGetUserByEmail.mockResolvedValue(adminUser({ role: undefined }));
    mockCompare.mockResolvedValue(true);

    await expect(loginUser({ email: 'a@x.com', password: 'x' }, mockReq()))
      .rejects.toMatchObject({ status: 403, code: 'admin_access_only' });
  });

  // 9. A LOGIN audit entry is written with the actor, email and ip
  it('should log a LOGIN audit entry', async () => {
    mockGetUserByEmail.mockResolvedValue(adminUser());
    mockCompare.mockResolvedValue(true);
    mockSignJwt.mockResolvedValue('tok');

    await loginUser({ email: 'admin@3mmile.com', password: 'x' }, mockReq({ ip: '10.0.0.9' }));

    expect(mockLogAudit).toHaveBeenCalledWith({
      userId: USER_ID, action: 'LOGIN', resource: 'User', details: { email: 'admin@3mmile.com' }, ip: '10.0.0.9',
    });
  });

  // 10. Missing req must not crash the audit call (ip becomes undefined)
  it('should tolerate a missing req and log ip as undefined', async () => {
    mockGetUserByEmail.mockResolvedValue(adminUser());
    mockCompare.mockResolvedValue(true);
    mockSignJwt.mockResolvedValue('tok');

    await loginUser({ email: 'admin@3mmile.com', password: 'x' });

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ ip: undefined }));
  });
});

describe('Auth — refreshAccessToken', () => {
  const validDecoded = { aud: USER_ID, iat: NOW_SEC - 60 };

  // 1. Happy path: a fresh access token is minted from a valid refresh token
  it('should verify against the REFRESH secret and mint a new access token', async () => {
    mockVerifyJwt.mockResolvedValue({ valid: true, expired: false, decodedToken: validDecoded });
    mockGetUser.mockResolvedValue(adminUser());
    mockSignJwt.mockResolvedValue('new.access');

    const result = await refreshAccessToken({ refreshToken: 'refresh.jwt' });

    expect(mockVerifyJwt).toHaveBeenCalledWith('refresh.jwt', 'REFRESH_TOKEN_SECRET');
    expect(mockGetUser).toHaveBeenCalledWith(USER_ID, true);
    expect(mockSignJwt).toHaveBeenCalledWith(USER_ID, 'ACCESS_TOKEN_SECRET', 'user');
    expect(result).toEqual({ accessToken: 'new.access' });
  });

  // 2. Invalid signature → 401 invalid_token, no user lookup
  it('should throw 401 invalid_token when the token is not valid', async () => {
    mockVerifyJwt.mockResolvedValue({ valid: false, expired: 'Unauthorized', decoded: null });

    await expect(refreshAccessToken({ refreshToken: 'bad' })).rejects.toMatchObject({ status: 401, code: 'invalid_token' });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  // 3. Expired token → 401 invalid_token
  it('should throw 401 invalid_token when the token is expired', async () => {
    mockVerifyJwt.mockResolvedValue({ valid: false, expired: true, decoded: null });

    await expect(refreshAccessToken({ refreshToken: 'old' })).rejects.toMatchObject({ status: 401, code: 'invalid_token' });
  });

  // 4. Valid flag but no decoded payload → 401 invalid_token
  it('should throw 401 invalid_token when decodedToken is missing', async () => {
    mockVerifyJwt.mockResolvedValue({ valid: true, expired: false, decodedToken: undefined });

    await expect(refreshAccessToken({ refreshToken: 't' })).rejects.toMatchObject({ status: 401, code: 'invalid_token' });
  });

  // 5. aud that is not an ObjectId → 401 invalid_token before hitting the DB
  it('should throw 401 invalid_token when aud is not a valid ObjectId', async () => {
    mockVerifyJwt.mockResolvedValue({ valid: true, expired: false, decodedToken: { aud: 'not-an-id', iat: NOW_SEC } });

    await expect(refreshAccessToken({ refreshToken: 't' })).rejects.toMatchObject({ status: 401, code: 'invalid_token' });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  // 6. User no longer exists → 401 invalid_token
  it('should throw 401 invalid_token when the user is not found', async () => {
    mockVerifyJwt.mockResolvedValue({ valid: true, expired: false, decodedToken: validDecoded });
    mockGetUser.mockResolvedValue(null);

    await expect(refreshAccessToken({ refreshToken: 't' })).rejects.toMatchObject({ status: 401, code: 'invalid_token' });
    expect(mockSignJwt).not.toHaveBeenCalled();
  });

  // 7. Deleted or inactive user → 401 invalid_token
  it('should throw 401 invalid_token when the user is deleted or inactive', async () => {
    mockVerifyJwt.mockResolvedValue({ valid: true, expired: false, decodedToken: validDecoded });
    mockGetUser.mockResolvedValueOnce(adminUser({ isDeleted: true })).mockResolvedValueOnce(adminUser({ isActive: false }));

    await expect(refreshAccessToken({ refreshToken: 't' })).rejects.toMatchObject({ status: 401, code: 'invalid_token' });
    await expect(refreshAccessToken({ refreshToken: 't' })).rejects.toMatchObject({ status: 401, code: 'invalid_token' });
  });

  // 8. Password changed after the token was issued → 401 invalid_token
  it('should throw 401 invalid_token when passwordChangedAt is after the token iat', async () => {
    mockVerifyJwt.mockResolvedValue({ valid: true, expired: false, decodedToken: { aud: USER_ID, iat: NOW_SEC - 3600 } });
    mockGetUser.mockResolvedValue(adminUser({ passwordChangedAt: new Date((NOW_SEC - 60) * 1000) }));

    await expect(refreshAccessToken({ refreshToken: 't' })).rejects.toMatchObject({ status: 401, code: 'invalid_token' });
    expect(mockSignJwt).not.toHaveBeenCalled();
  });

  // 9. Password changed BEFORE the token was issued is fine
  it('should accept a token issued after the last password change', async () => {
    mockVerifyJwt.mockResolvedValue({ valid: true, expired: false, decodedToken: { aud: USER_ID, iat: NOW_SEC } });
    mockGetUser.mockResolvedValue(adminUser({ passwordChangedAt: new Date((NOW_SEC - 3600) * 1000) }));
    mockSignJwt.mockResolvedValue('ok');

    await expect(refreshAccessToken({ refreshToken: 't' })).resolves.toEqual({ accessToken: 'ok' });
  });

  // 10. Demoted admin → 401 invalid_token
  it('should throw 401 invalid_token when the user is no longer Admin', async () => {
    mockVerifyJwt.mockResolvedValue({ valid: true, expired: false, decodedToken: validDecoded });
    mockGetUser.mockResolvedValue(adminUser({ role: { name: 'Viewer' } }));

    await expect(refreshAccessToken({ refreshToken: 't' })).rejects.toMatchObject({ status: 401, code: 'invalid_token' });
    expect(mockSignJwt).not.toHaveBeenCalled();
  });
});
