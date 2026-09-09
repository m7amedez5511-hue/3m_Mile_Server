import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
jest.unstable_mockModule('../../utils/winston.js', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
  consoleLogger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const { restrictTo } = await import('../../middleware/permission.middleware.js');

const mockRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

// asyncHandler does not return the promise, so resolve once next() fires
const run = (middleware, req) => new Promise((resolve) => {
  const next = jest.fn((err) => resolve({ err, next }));
  middleware(req, mockRes(), next);
});

describe('Permission middleware — restrictTo', () => {
  // 1. Admin role bypasses the permission check entirely
  it('should call next() for an Admin regardless of permissions', async () => {
    const { err, next } = await run(restrictTo('product:write'), { user: { role: { name: 'Admin', permissions: [] } } });

    expect(err).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  // 2. A non-admin holding the matching slug passes
  it('should call next() when the role holds the required permission slug', async () => {
    const req = { user: { role: { name: 'Editor', permissions: [{ permission: { slug: 'product:read' } }, { permission: { slug: 'product:write' } }] } } };

    const { err, next } = await run(restrictTo('product:write'), req);

    expect(err).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  // 3. Missing slug → 403 user_not_authorized
  it('should forward 403 user_not_authorized when the slug is missing', async () => {
    const req = { user: { role: { name: 'Editor', permissions: [{ permission: { slug: 'product:read' } }] } } };

    const { err, next } = await run(restrictTo('product:delete'), req);

    expect(err).toMatchObject({ status: 403, code: 'user_not_authorized' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  // 4. Role without a permissions array → 403
  it('should forward 403 when the role has no permissions array', async () => {
    const { err } = await run(restrictTo('faq:write'), { user: { role: { name: 'Editor' } } });

    expect(err).toMatchObject({ status: 403, code: 'user_not_authorized' });
  });

  // 5. Malformed permission entries (no nested permission) are ignored safely
  it('should treat entries without a nested permission object as non-matching', async () => {
    const { err } = await run(restrictTo('faq:write'), { user: { role: { name: 'Editor', permissions: [{}, { permission: null }] } } });

    expect(err).toMatchObject({ status: 403, code: 'user_not_authorized' });
  });

  // 6. No req.user at all → 403 rather than a TypeError
  it('should forward 403 when req.user is absent', async () => {
    const { err } = await run(restrictTo('user:read'), {});

    expect(err).toMatchObject({ status: 403, code: 'user_not_authorized' });
  });
});
