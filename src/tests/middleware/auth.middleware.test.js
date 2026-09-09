import { jest } from '@jest/globals';

// The middleware reads TOKEN_PREFIX at call time — make sure the default ("Bearer") applies
delete process.env.TOKEN_PREFIX;

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockVerifyJwt = jest.fn();
const mockGetUser = jest.fn();

jest.unstable_mockModule('../../utils/jwt.utils.js', () => ({ verifyJwt: mockVerifyJwt, signJwt: jest.fn(), decodeJWT: jest.fn() }));
jest.unstable_mockModule('../../services/user.service.js', () => ({ getUser: mockGetUser, getUserByEmail: jest.fn() }));
jest.unstable_mockModule('../../utils/winston.js', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
  consoleLogger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const { isAuthorized } = await import('../../middleware/auth.middleware.js');

const USER_ID = '64a1f0c2e4b0a1b2c3d4e5f6';
const NOW_SEC = Math.floor(Date.now() / 1000);
const mockReq = (authorization) => ({ headers: authorization === undefined ? {} : { authorization }, ip: '127.0.0.1' });
const mockRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const activeUser = (overrides = {}) => ({
  _id: USER_ID, email: 'a@b.co', password: 'hashed', isActive: true, isDeleted: false, role: { name: 'Admin' }, ...overrides,
});
const validToken = (overrides = {}) => ({ valid: true, expired: false, decodedToken: { aud: USER_ID, iat: NOW_SEC - 60, ...overrides } });

// asyncHandler does not return the promise, so resolve once next() fires
const run = (req) => new Promise((resolve) => {
  const next = jest.fn((err) => resolve({ err, next }));
  isAuthorized(req, mockRes(), next);
});

describe('Auth middleware — isAuthorized', () => {
  // 1. Missing Authorization header → 401 Unauthorized, no verification attempted
  it('should reject a request with no authorization header', async () => {
    const { err } = await run(mockReq());

    expect(err).toMatchObject({ status: 401, code: 'Unauthorized' });
    expect(mockVerifyJwt).not.toHaveBeenCalled();
  });

  // 2. Wrong scheme prefix → 401
  it('should reject a header that does not start with the Bearer prefix', async () => {
    const { err } = await run(mockReq('Basic abc123'));

    expect(err).toMatchObject({ status: 401, code: 'Unauthorized' });
    expect(mockVerifyJwt).not.toHaveBeenCalled();
  });

  // 3. Prefix with no token → 401
  it('should reject "Bearer" with an empty token', async () => {
    const { err: a } = await run(mockReq('Bearer'));
    const { err: b } = await run(mockReq('Bearer '));

    expect(a).toMatchObject({ status: 401, code: 'Unauthorized' });
    expect(b).toMatchObject({ status: 401, code: 'Unauthorized' });
    expect(mockVerifyJwt).not.toHaveBeenCalled();
  });

  // 4. Multiple spaces produce >2 parts and an empty token → 401
  it('should reject "Bearer  token" with a double space', async () => {
    const { err } = await run(mockReq('Bearer  tok'));

    expect(err).toMatchObject({ status: 401, code: 'Unauthorized' });
    expect(mockVerifyJwt).not.toHaveBeenCalled();
  });

  // 5. Invalid signature → 401
  it('should reject an invalid token', async () => {
    mockVerifyJwt.mockResolvedValue({ valid: false, expired: 'Unauthorized', decoded: null });

    const { err } = await run(mockReq('Bearer bad.token'));

    expect(mockVerifyJwt).toHaveBeenCalledWith('bad.token', 'ACCESS_TOKEN_SECRET');
    expect(err).toMatchObject({ status: 401, code: 'Unauthorized' });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  // 6. Expired token → 401
  it('should reject an expired token', async () => {
    mockVerifyJwt.mockResolvedValue({ valid: false, expired: true, decoded: null });

    const { err } = await run(mockReq('Bearer old.token'));

    expect(err).toMatchObject({ status: 401, code: 'Unauthorized' });
  });

  // 7. valid but no payload → 401
  it('should reject when decodedToken is missing', async () => {
    mockVerifyJwt.mockResolvedValue({ valid: true, expired: false, decodedToken: undefined });

    const { err } = await run(mockReq('Bearer t'));

    expect(err).toMatchObject({ status: 401, code: 'Unauthorized' });
  });

  // 8. aud that is not an ObjectId → 401 before any DB access
  it('should reject a token whose aud is not a valid ObjectId', async () => {
    mockVerifyJwt.mockResolvedValue(validToken({ aud: 'not-an-object-id' }));

    const { err } = await run(mockReq('Bearer t'));

    expect(err).toMatchObject({ status: 401, code: 'Unauthorized' });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  // 9. User not found → 401
  it('should reject when the user no longer exists', async () => {
    mockVerifyJwt.mockResolvedValue(validToken());
    mockGetUser.mockResolvedValue(null);

    const { err } = await run(mockReq('Bearer t'));

    expect(mockGetUser).toHaveBeenCalledWith(USER_ID, true);
    expect(err).toMatchObject({ status: 401, code: 'Unauthorized' });
  });

  // 10. Inactive or deleted user → 401
  it('should reject an inactive or soft-deleted user', async () => {
    mockVerifyJwt.mockResolvedValue(validToken());
    mockGetUser.mockResolvedValueOnce(activeUser({ isActive: false })).mockResolvedValueOnce(activeUser({ isDeleted: true }));

    const { err: a } = await run(mockReq('Bearer t'));
    const { err: b } = await run(mockReq('Bearer t'));

    expect(a).toMatchObject({ status: 401, code: 'Unauthorized' });
    expect(b).toMatchObject({ status: 401, code: 'Unauthorized' });
  });

  // 11. Password changed after the token was issued → 401
  it('should reject when passwordChangedAt is later than the token iat', async () => {
    mockVerifyJwt.mockResolvedValue(validToken({ iat: NOW_SEC - 3600 }));
    mockGetUser.mockResolvedValue(activeUser({ passwordChangedAt: new Date((NOW_SEC - 60) * 1000) }));

    const { err } = await run(mockReq('Bearer t'));

    expect(err).toMatchObject({ status: 401, code: 'Unauthorized' });
  });

  // 12. Password changed before issuance is accepted
  it('should accept when passwordChangedAt is earlier than the token iat', async () => {
    mockVerifyJwt.mockResolvedValue(validToken({ iat: NOW_SEC }));
    mockGetUser.mockResolvedValue(activeUser({ passwordChangedAt: new Date((NOW_SEC - 3600) * 1000) }));
    const req = mockReq('Bearer t');

    const { err } = await run(req);

    expect(err).toBeUndefined();
    expect(req.user._id).toBe(USER_ID);
  });

  // 13. Success: req.user is attached without password, req.token holds the payload, next() called once
  it('should attach req.user without password and req.token, then call next()', async () => {
    const decoded = validToken();
    mockVerifyJwt.mockResolvedValue(decoded);
    mockGetUser.mockResolvedValue(activeUser());
    const req = mockReq('Bearer good.token');

    const { err, next } = await run(req);

    expect(err).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ _id: USER_ID, email: 'a@b.co', isActive: true, isDeleted: false, role: { name: 'Admin' } });
    expect(req.user.password).toBeUndefined();
    expect(req.token).toBe(decoded.decodedToken);
  });

  // 14. Token glued to the prefix without a space is still extracted (current behaviour)
  it('should extract the token when it is glued to the prefix without a space', async () => {
    mockVerifyJwt.mockResolvedValue(validToken());
    mockGetUser.mockResolvedValue(activeUser());

    const { err } = await run(mockReq('Bearerglued.token'));

    expect(mockVerifyJwt).toHaveBeenCalledWith('glued.token', 'ACCESS_TOKEN_SECRET');
    expect(err).toBeUndefined();
  });
});
