import { jest } from '@jest/globals';
import JWT from 'jsonwebtoken';

// Dummy secrets MUST exist before the module under test reads process.env
process.env.ACCESS_TOKEN_SECRET = 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockLogger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
jest.unstable_mockModule('../../utils/winston.js', () => ({
  logger: mockLogger,
  consoleLogger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const { signJwt, verifyJwt, decodeJWT } = await import('../../utils/jwt.utils.js');

const USER_ID = '64a1f0c2e4b0a1b2c3d4e5f6';

describe('JWT utils — signJwt', () => {
  // 1. Access token: signed with the access secret, 15m lifetime, aud = userId, iss = issuer
  it('should sign an access token with aud, iss and a 15 minute expiry', async () => {
    const token = await signJwt(USER_ID, 'ACCESS_TOKEN_SECRET', 'user');

    const payload = JWT.verify(token, process.env.ACCESS_TOKEN_SECRET);
    expect(payload.aud).toBe(USER_ID);
    expect(payload.iss).toBe('user');
    expect(payload.exp - payload.iat).toBe(15 * 60);
  });

  // 2. Refresh token: signed with the refresh secret and a 30 day lifetime
  it('should sign a refresh token with the refresh secret and a 30 day expiry', async () => {
    const token = await signJwt(USER_ID, 'REFRESH_TOKEN_SECRET', 'user');

    const payload = JWT.verify(token, process.env.REFRESH_TOKEN_SECRET);
    expect(payload.exp - payload.iat).toBe(30 * 24 * 60 * 60);
    expect(() => JWT.verify(token, process.env.ACCESS_TOKEN_SECRET)).toThrow(/invalid signature/);
  });

  // 3. Non-string user ids are stringified into aud
  it('should coerce a non-string userId into the aud claim', async () => {
    const token = await signJwt({ toString: () => USER_ID }, 'ACCESS_TOKEN_SECRET');

    expect(JWT.decode(token).aud).toBe(USER_ID);
  });

  // 4. issuer is omitted when not provided
  it('should not set iss when no issuer is given', async () => {
    const token = await signJwt(USER_ID, 'ACCESS_TOKEN_SECRET');

    expect(JWT.decode(token).iss).toBeUndefined();
  });

  // 5. Extra params become the payload body
  it('should embed custom params in the payload', async () => {
    const token = await signJwt(USER_ID, 'ACCESS_TOKEN_SECRET', 'user', { scope: 'admin' });

    expect(JWT.decode(token)).toMatchObject({ scope: 'admin', aud: USER_ID, iss: 'user' });
  });

  // 6. Missing secret → rejected with 500 and the error is logged
  it('should reject with a 500 error and log when the secret env var is missing', async () => {
    await expect(signJwt(USER_ID, 'MISSING_SECRET_KEY')).rejects.toMatchObject({ status: 500 });
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });
});

describe('JWT utils — verifyJwt', () => {
  // 1. A token signed with the matching secret verifies and returns the payload
  it('should return valid:true with the decoded payload for a good token', async () => {
    const token = JWT.sign({}, process.env.ACCESS_TOKEN_SECRET, { audience: USER_ID, issuer: 'user', expiresIn: '5m' });

    const result = await verifyJwt(token, 'ACCESS_TOKEN_SECRET');

    expect(result.valid).toBe(true);
    expect(result.expired).toBe(false);
    expect(result.decodedToken).toMatchObject({ aud: USER_ID, iss: 'user' });
  });

  // 2. Wrong secret → valid:false, expired holds the string 'Unauthorized'
  it("should return valid:false and expired:'Unauthorized' for a wrong-secret token", async () => {
    const token = JWT.sign({}, 'some-other-secret', { audience: USER_ID });

    const result = await verifyJwt(token, 'ACCESS_TOKEN_SECRET');

    // NOTE: the failure shape uses `decoded`, not `decodedToken`, and `expired` is a string here
    expect(result).toEqual({ valid: false, expired: 'Unauthorized', decoded: null });
    expect(result.decodedToken).toBeUndefined();
  });

  // 3. Malformed token → JsonWebTokenError → 'Unauthorized'
  it('should return valid:false for a malformed token', async () => {
    const result = await verifyJwt('not.a.jwt', 'ACCESS_TOKEN_SECRET');

    expect(result).toEqual({ valid: false, expired: 'Unauthorized', decoded: null });
  });

  // 4. Expired token → expired:true
  it('should return expired:true for an expired token', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = JWT.sign({ exp: nowSec - 10 }, process.env.ACCESS_TOKEN_SECRET, { audience: USER_ID });

    const result = await verifyJwt(token, 'ACCESS_TOKEN_SECRET');

    expect(result).toEqual({ valid: false, expired: true, decoded: null });
  });

  // 5. An access token does not verify against the refresh secret
  it('should reject an access token checked against the REFRESH secret', async () => {
    const accessToken = await signJwt(USER_ID, 'ACCESS_TOKEN_SECRET', 'user');

    const result = await verifyJwt(accessToken, 'REFRESH_TOKEN_SECRET');

    expect(result.valid).toBe(false);
  });
});

describe('JWT utils — decodeJWT', () => {
  // 1. Decodes without verifying the signature
  it('should decode the payload without checking the signature', () => {
    const token = JWT.sign({ foo: 'bar' }, 'unrelated-secret', { audience: USER_ID });

    expect(decodeJWT(token)).toMatchObject({ foo: 'bar', aud: USER_ID });
  });

  // 2. Garbage input yields null
  it('should return null for a non-JWT string', () => {
    expect(decodeJWT('garbage')).toBeNull();
  });
});
