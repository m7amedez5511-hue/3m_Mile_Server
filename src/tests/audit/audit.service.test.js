import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockCrud = {
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
};

jest.unstable_mockModule('../../services/crud.service.js', () => ({ default: () => mockCrud }));

const { listAuditLogs, getAuditLogById, createAuditLog } = await import('../../services/audit.service.js');

const LOG_ID = '64a1f0c2e4b0a1b2c3d4e5f9';

describe('Audit — listAuditLogs', () => {
  // 1. Defaults: no filter, newest first, page 1 / limit 10
  it('should fetch page 1 limit 10 sorted newest-first by default', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ rows: [], total: 0, count: 0, data: [] });

    const result = await listAuditLogs();

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith({}, { page: 1, limit: 10, sort: { createdAt: -1 } });
    expect(result).toEqual({ items: [], total: 0, page: 1, limit: 10 });
  });

  // 2. Rows/total are re-shaped into items/total and paging echoed back
  it('should map rows to items and echo page/limit', async () => {
    const rows = [{ _id: LOG_ID, action: 'LOGIN' }];
    mockCrud.findAndCountAll.mockResolvedValue({ rows, total: 42, count: 42, data: rows });

    const result = await listAuditLogs({ page: 3, limit: 5 });

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith({}, { page: 3, limit: 5, sort: { createdAt: -1 } });
    expect(result).toEqual({ items: rows, total: 42, page: 3, limit: 5 });
  });

  // 3. Partial options fall back to defaults per-field
  it('should default limit when only page is provided', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ rows: [], total: 0 });

    const result = await listAuditLogs({ page: 2 });

    expect(result).toMatchObject({ page: 2, limit: 10 });
  });
});

describe('Audit — getAuditLogById', () => {
  // 1. Found log is returned
  it('should return the log when found', async () => {
    const log = { _id: LOG_ID, action: 'CREATE' };
    mockCrud.findByPk.mockResolvedValue(log);

    const result = await getAuditLogById(LOG_ID);

    expect(mockCrud.findByPk).toHaveBeenCalledWith(LOG_ID);
    expect(result).toBe(log);
  });

  // 2. Missing log → 404 audit_log_not_found
  it('should throw 404 audit_log_not_found when nothing matches', async () => {
    mockCrud.findByPk.mockResolvedValue(null);

    await expect(getAuditLogById(LOG_ID)).rejects.toMatchObject({ status: 404, code: 'audit_log_not_found' });
  });
});

describe('Audit — createAuditLog', () => {
  // 1. Only the five whitelisted fields reach the database
  it('should create the entry with user/action/resource/details/ip only', async () => {
    mockCrud.create.mockImplementation(async (data) => ({ _id: LOG_ID, ...data }));

    const result = await createAuditLog({
      user: 'admin-id', action: 'UPDATE', resource: 'Product', details: { id: 'p1' }, ip: '10.0.0.1', extra: 'dropped',
    });

    expect(mockCrud.create).toHaveBeenCalledWith({
      user: 'admin-id', action: 'UPDATE', resource: 'Product', details: { id: 'p1' }, ip: '10.0.0.1',
    });
    expect(result._id).toBe(LOG_ID);
  });

  // 2. Optional fields are passed as undefined rather than omitted
  it('should pass undefined for missing details/ip', async () => {
    mockCrud.create.mockResolvedValue({});

    await createAuditLog({ user: 'u', action: 'DELETE', resource: 'Branch' });

    expect(mockCrud.create).toHaveBeenCalledWith({ user: 'u', action: 'DELETE', resource: 'Branch', details: undefined, ip: undefined });
  });

  // 3. Database failures propagate (this is the explicit, awaited variant)
  it('should propagate a create failure', async () => {
    mockCrud.create.mockRejectedValue(new Error('db down'));

    await expect(createAuditLog({ user: 'u', action: 'CREATE', resource: 'X' })).rejects.toThrow('db down');
  });
});
