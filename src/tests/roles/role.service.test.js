import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockCrud = {
  findAll: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  findByPk: jest.fn(),
  destroy: jest.fn(),
};
const FULL_PERMISSIONS = [
  { permission: { slug: 'user:read', name: 'View users' } },
  { permission: { slug: 'audit:read', name: 'Read audit logs' } },
];
const mockBuildFullPermissionSet = jest.fn(() => FULL_PERMISSIONS);
const mockLogAudit = jest.fn();
const mockActorFromReq = jest.fn(() => ({ userId: 'admin-id', ip: '127.0.0.1' }));

jest.unstable_mockModule('../../services/crud.service.js', () => ({ default: () => mockCrud }));
jest.unstable_mockModule('../../constants/permissions.constant.js', () => ({
  PERMISSIONS: [],
  buildFullPermissionSet: mockBuildFullPermissionSet,
}));
jest.unstable_mockModule('../../utils/auditLogger.js', () => ({ logAudit: mockLogAudit, actorFromReq: mockActorFromReq }));

const { listRoles, createRole, deleteRole } = await import('../../services/role.service.js');

const ROLE_ID = '64a1f0c2e4b0a1b2c3d4e5f8';
const mockReq = () => ({ ip: '127.0.0.1', user: { _id: 'admin-id' } });

describe('Roles — listRoles', () => {
  // 1. Returns every role with an empty filter
  it('should return all roles via findAll({})', async () => {
    const roles = [{ _id: ROLE_ID, name: 'Admin' }];
    mockCrud.findAll.mockResolvedValue(roles);

    const result = await listRoles();

    expect(mockCrud.findAll).toHaveBeenCalledWith({});
    expect(result).toBe(roles);
  });
});

describe('Roles — createRole', () => {
  // 1. Creates the single system Admin role with the full permission set
  it('should create the Admin system role with the full permission set when none exists', async () => {
    mockCrud.count.mockResolvedValue(0);
    mockCrud.create.mockImplementation(async (data) => ({ _id: ROLE_ID, ...data }));

    const result = await createRole(mockReq());

    expect(mockCrud.count).toHaveBeenCalledWith({});
    expect(mockBuildFullPermissionSet).toHaveBeenCalledTimes(1);
    expect(mockCrud.create).toHaveBeenCalledWith({ name: 'Admin', permissions: FULL_PERMISSIONS, isSystem: true });
    expect(result).toEqual({ _id: ROLE_ID, name: 'Admin', permissions: FULL_PERMISSIONS, isSystem: true });
  });

  // 2. A second role is refused → 400 and nothing is written
  it('should throw 400 only_one_system_administrator_role_allowed when a role already exists', async () => {
    mockCrud.count.mockResolvedValue(1);

    await expect(createRole(mockReq())).rejects.toMatchObject({ status: 400, code: 'only_one_system_administrator_role_allowed' });
    expect(mockCrud.create).not.toHaveBeenCalled();
  });

  // 3. Audit logging is currently commented out in the source — assert present behaviour
  it('should NOT write a CREATE audit entry (logging is disabled in the source)', async () => {
    mockCrud.count.mockResolvedValue(0);
    mockCrud.create.mockResolvedValue({ _id: ROLE_ID });

    await createRole(mockReq());

    expect(mockLogAudit).not.toHaveBeenCalled();
    expect(mockActorFromReq).not.toHaveBeenCalled();
  });
});

describe('Roles — deleteRole', () => {
  // 1. Unknown role → 404 role_not_found
  it('should throw 404 role_not_found when the role does not exist', async () => {
    mockCrud.findByPk.mockResolvedValue(null);

    await expect(deleteRole(ROLE_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'role_not_found' });
    expect(mockCrud.findByPk).toHaveBeenCalledWith(ROLE_ID);
    expect(mockCrud.destroy).not.toHaveBeenCalled();
  });

  // 2. System role → 403 system_role_cannot_be_deleted
  it('should throw 403 system_role_cannot_be_deleted for the system role', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: ROLE_ID, name: 'Admin', isSystem: true });

    await expect(deleteRole(ROLE_ID, mockReq())).rejects.toMatchObject({ status: 403, code: 'system_role_cannot_be_deleted' });
    expect(mockCrud.destroy).not.toHaveBeenCalled();
  });

  // 3. A non-system role is hard-deleted and the destroy result returned
  it('should destroy a non-system role and return the result', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: ROLE_ID, name: 'Custom', isSystem: false });
    mockCrud.destroy.mockResolvedValue({ deletedCount: 1, acknowledged: true, affectedRows: 1 });

    const result = await deleteRole(ROLE_ID, mockReq());

    expect(mockCrud.destroy).toHaveBeenCalledWith({ _id: ROLE_ID });
    expect(result).toEqual({ deletedCount: 1, acknowledged: true, affectedRows: 1 });
  });

  // 4. Audit logging is commented out in the source — assert present behaviour
  it('should NOT write a DELETE audit entry (logging is disabled in the source)', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: ROLE_ID, isSystem: false });
    mockCrud.destroy.mockResolvedValue({ deletedCount: 1 });

    await deleteRole(ROLE_ID, mockReq());

    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});
