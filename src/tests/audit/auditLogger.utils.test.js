import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockCrud = { create: jest.fn() };

jest.unstable_mockModule('../../services/crud.service.js', () => ({ default: () => mockCrud }));

const { logAudit, actorFromReq } = await import('../../utils/auditLogger.js');

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('Audit logger — logAudit', () => {
  // 1. Maps userId → user and writes the entry fire-and-forget
  it('should create an AuditLog entry mapping userId to user', () => {
    mockCrud.create.mockResolvedValue({});

    const returned = logAudit({ userId: 'admin-id', action: 'CREATE', resource: 'Product', details: { id: 'p1' }, ip: '127.0.0.1' });

    expect(mockCrud.create).toHaveBeenCalledWith({
      user: 'admin-id', action: 'CREATE', resource: 'Product', details: { id: 'p1' }, ip: '127.0.0.1',
    });
    expect(returned).toBeUndefined();
  });

  // 2. A rejected write must be swallowed — the caller never sees it
  it('should not throw or produce an unhandled rejection when create rejects', async () => {
    mockCrud.create.mockRejectedValue(new Error('db down'));
    const onUnhandled = jest.fn();
    process.on('unhandledRejection', onUnhandled);

    expect(() => logAudit({ userId: 'u', action: 'DELETE', resource: 'X' })).not.toThrow();
    await flush();

    process.off('unhandledRejection', onUnhandled);
    expect(onUnhandled).not.toHaveBeenCalled();
  });

  // 3. Undefined optional fields are forwarded as undefined
  it('should forward undefined details/ip', () => {
    mockCrud.create.mockResolvedValue({});

    logAudit({ userId: 'u', action: 'LOGIN', resource: 'User' });

    expect(mockCrud.create).toHaveBeenCalledWith({ user: 'u', action: 'LOGIN', resource: 'User', details: undefined, ip: undefined });
  });
});

describe('Audit logger — actorFromReq', () => {
  // 1. Prefers req.user._id
  it('should use req.user._id and req.ip', () => {
    expect(actorFromReq({ user: { _id: 'abc', id: 'ignored' }, ip: '1.2.3.4' })).toEqual({ userId: 'abc', ip: '1.2.3.4' });
  });

  // 2. Falls back to req.user.id
  it('should fall back to req.user.id when _id is absent', () => {
    expect(actorFromReq({ user: { id: 'xyz' }, ip: '1.2.3.4' })).toEqual({ userId: 'xyz', ip: '1.2.3.4' });
  });

  // 3. Missing user → undefined userId (no throw)
  it('should return undefined userId when req.user is missing', () => {
    expect(actorFromReq({ ip: '9.9.9.9' })).toEqual({ userId: undefined, ip: '9.9.9.9' });
  });
});
