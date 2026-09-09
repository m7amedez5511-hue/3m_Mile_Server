import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockCrud = {
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
};
const mockResolveSlug = jest.fn();
const mockLogAudit = jest.fn();
const mockActorFromReq = jest.fn(() => ({ userId: 'admin-id', ip: '127.0.0.1' }));

jest.unstable_mockModule('../../services/crud.service.js', () => ({ default: () => mockCrud }));
jest.unstable_mockModule('../../utils/buildSlugify.js', () => ({ resolveSlug: mockResolveSlug }));
jest.unstable_mockModule('../../utils/auditLogger.js', () => ({ logAudit: mockLogAudit, actorFromReq: mockActorFromReq }));

const {
  listWarrantyGroups, getWarrantyGroupById, createWarrantyGroup, updateWarrantyGroup, deleteWarrantyGroup,
} = await import('../../services/warrantyGroup.service.js');

const GROUP_ID = '64a1f0c2e4b0a1b2c3d4e5f6';
const mockReq = (body = {}, extra = {}) => ({ body, ip: '127.0.0.1', user: { _id: 'admin-id' }, ...extra });

describe('WarrantyGroups — listWarrantyGroups', () => {
  // 1. Default listing filters out soft-deleted rows, page 1 / limit 50, sorted by order then newest
  it('should query non-deleted groups sorted by order then createdAt with default pagination', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listWarrantyGroups();

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith(
      { isDeleted: false },
      { page: 1, limit: 50, sort: { order: 1, createdAt: -1 } },
    );
  });

  // 2. isActive is only applied when explicitly passed
  it('should apply isActive when provided and skip it when undefined', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listWarrantyGroups({ isActive: true });
    await listWarrantyGroups({ isActive: false });
    await listWarrantyGroups({ isActive: undefined });

    expect(mockCrud.findAndCountAll.mock.calls[0][0]).toEqual({ isDeleted: false, isActive: true });
    expect(mockCrud.findAndCountAll.mock.calls[1][0]).toEqual({ isDeleted: false, isActive: false });
    expect(mockCrud.findAndCountAll.mock.calls[2][0]).toEqual({ isDeleted: false });
  });

  // 3. Pagination values are forwarded as given
  it('should forward page and limit', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listWarrantyGroups({ page: 2, limit: 5 });

    expect(mockCrud.findAndCountAll.mock.calls[0][1]).toMatchObject({ page: 2, limit: 5 });
  });

  // 4. The crud result is returned untouched
  it('should return the crud result as-is', async () => {
    const payload = { count: 1, rows: [{ _id: GROUP_ID }] };
    mockCrud.findAndCountAll.mockResolvedValue(payload);

    const result = await listWarrantyGroups();

    expect(result).toBe(payload);
  });
});

describe('WarrantyGroups — getWarrantyGroupById', () => {
  // 1. Found group is returned
  it('should return the group when found and not deleted', async () => {
    const group = { _id: GROUP_ID, title: 'Gold', isDeleted: false };
    mockCrud.findByPk.mockResolvedValue(group);

    const result = await getWarrantyGroupById(GROUP_ID);

    expect(mockCrud.findByPk).toHaveBeenCalledWith(GROUP_ID);
    expect(result).toBe(group);
  });

  // 2. Missing group → 404
  it('should throw 404 warranty_group_not_found when nothing matches', async () => {
    mockCrud.findByPk.mockResolvedValue(null);

    await expect(getWarrantyGroupById(GROUP_ID)).rejects.toMatchObject({ status: 404, code: 'warranty_group_not_found' });
  });

  // 3. Soft-deleted group is treated as missing
  it('should throw 404 when the group is soft-deleted', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: GROUP_ID, isDeleted: true });

    await expect(getWarrantyGroupById(GROUP_ID)).rejects.toMatchObject({ status: 404, code: 'warranty_group_not_found' });
  });
});

describe('WarrantyGroups — createWarrantyGroup', () => {
  // 1. Whitelisted fields are copied and the slug is resolved from the title
  it('should copy whitelisted fields, resolve the slug from the title and create the group', async () => {
    mockResolveSlug.mockResolvedValue('gold-plan');
    mockCrud.create.mockImplementation(async (data) => ({ _id: GROUP_ID, ...data }));
    const tiers = [{ title: 'Basic', warranty: '1 year', maintenance: '', terms: [] }];

    const result = await createWarrantyGroup(mockReq({ title: 'Gold Plan', intro: 'Intro', tiers, order: 2, isActive: false }));

    expect(mockResolveSlug).toHaveBeenCalledWith('WarrantyGroup', undefined, 'Gold Plan');
    expect(mockCrud.create).toHaveBeenCalledWith({
      title: 'Gold Plan', intro: 'Intro', tiers, order: 2, isActive: false, slug: 'gold-plan',
    });
    expect(result._id).toBe(GROUP_ID);
  });

  // 2. Non-whitelisted fields never reach the database
  it('should ignore non-whitelisted fields (isDeleted, image, arbitrary keys)', async () => {
    mockResolveSlug.mockResolvedValue('x');
    mockCrud.create.mockResolvedValue({ _id: GROUP_ID });

    await createWarrantyGroup(mockReq({ title: 'X', isDeleted: true, image: 'hack.png', slug_hack: 'y' }));

    expect(mockCrud.create).toHaveBeenCalledWith({ title: 'X', slug: 'x' });
  });

  // 3. Undefined fields are skipped, so no undefined keys are written
  it('should not include undefined whitelisted fields', async () => {
    mockResolveSlug.mockResolvedValue('t');
    mockCrud.create.mockResolvedValue({ _id: GROUP_ID });

    await createWarrantyGroup(mockReq({ title: 'T', intro: undefined }));

    expect(Object.keys(mockCrud.create.mock.calls[0][0])).toEqual(['title', 'slug']);
  });

  // 4. An admin-supplied slug is passed through to resolveSlug
  it('should pass the admin-supplied slug to resolveSlug', async () => {
    mockResolveSlug.mockResolvedValue('custom');
    mockCrud.create.mockResolvedValue({ _id: GROUP_ID });

    await createWarrantyGroup(mockReq({ title: 'Any', slug: 'custom' }));

    expect(mockResolveSlug).toHaveBeenCalledWith('WarrantyGroup', 'custom', 'Any');
    expect(mockCrud.create.mock.calls[0][0].slug).toBe('custom');
  });

  // 5. A CREATE audit entry is written for the acting admin
  it('should log a CREATE audit entry with the actor, id and title', async () => {
    mockResolveSlug.mockResolvedValue('p');
    mockCrud.create.mockResolvedValue({ _id: GROUP_ID });
    const req = mockReq({ title: 'Plan' });

    await createWarrantyGroup(req);

    expect(mockActorFromReq).toHaveBeenCalledWith(req);
    expect(mockLogAudit).toHaveBeenCalledWith({
      userId: 'admin-id', ip: '127.0.0.1', action: 'CREATE', resource: 'WarrantyGroup', details: { id: GROUP_ID, title: 'Plan' },
    });
  });
});

describe('WarrantyGroups — updateWarrantyGroup', () => {
  const existing = { _id: GROUP_ID, title: 'Orig', slug: 'orig', isDeleted: false };

  // 1. Only whitelisted fields reach the database
  it('should update only whitelisted fields (no isDeleted/image mass-assignment)', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue({ ...existing, title: 'New' });

    const result = await updateWarrantyGroup(GROUP_ID, mockReq({ title: 'New', order: 3, isDeleted: true, image: 'x', slug_hack: 'y' }));

    expect(mockCrud.findByPk).toHaveBeenCalledWith(GROUP_ID);
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: GROUP_ID }, { title: 'New', order: 3 });
    expect(mockResolveSlug).not.toHaveBeenCalled();
    expect(result).toEqual({ ...existing, title: 'New' });
  });

  // 2. Missing / deleted group → 404 and no write
  it('should throw 404 and not write when the group is missing or deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...existing, isDeleted: true });

    await expect(updateWarrantyGroup(GROUP_ID, mockReq({ title: 'x' }))).rejects.toMatchObject({ status: 404, code: 'warranty_group_not_found' });
    await expect(updateWarrantyGroup(GROUP_ID, mockReq({ title: 'x' }))).rejects.toMatchObject({ status: 404, code: 'warranty_group_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  // 3. Slug is re-resolved only when a slug key is present, using the new title when given
  it('should re-resolve the slug with the new title and excludeId when req.body.slug is provided', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    mockResolveSlug.mockResolvedValue('renamed');

    await updateWarrantyGroup(GROUP_ID, mockReq({ title: 'Renamed', slug: 'custom' }));

    expect(mockResolveSlug).toHaveBeenCalledWith('WarrantyGroup', 'custom', 'Renamed', GROUP_ID);
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: GROUP_ID }, { title: 'Renamed', slug: 'renamed' });
  });

  // 4. Empty slug falls back to the stored title for derivation
  it('should fall back to the existing title when slug is empty and no title is sent', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    mockResolveSlug.mockResolvedValue('orig');

    await updateWarrantyGroup(GROUP_ID, mockReq({ slug: '' }));

    expect(mockResolveSlug).toHaveBeenCalledWith('WarrantyGroup', '', 'Orig', GROUP_ID);
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: GROUP_ID }, { slug: 'orig' });
  });

  // 5. An empty body still performs a (no-op) update
  it('should call findOneAndUpdate with an empty patch when nothing updatable is sent', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateWarrantyGroup(GROUP_ID, mockReq({}));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: GROUP_ID }, {});
  });

  // 6. An UPDATE audit entry is written
  it('should log an UPDATE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const req = mockReq({ title: 'x' });

    await updateWarrantyGroup(GROUP_ID, req);

    expect(mockActorFromReq).toHaveBeenCalledWith(req);
    expect(mockLogAudit).toHaveBeenCalledWith({
      userId: 'admin-id', ip: '127.0.0.1', action: 'UPDATE', resource: 'WarrantyGroup', details: { id: GROUP_ID },
    });
  });
});

describe('WarrantyGroups — deleteWarrantyGroup', () => {
  // 1. Soft delete: mark deleted and deactivate
  it('should soft-delete the group by setting isDeleted and isActive:false', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: GROUP_ID, isDeleted: false });
    mockCrud.findOneAndUpdate.mockResolvedValue({ _id: GROUP_ID, isDeleted: true });

    const result = await deleteWarrantyGroup(GROUP_ID, mockReq());

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: GROUP_ID }, { isDeleted: true, isActive: false });
    expect(result).toEqual({ _id: GROUP_ID, isDeleted: true });
  });

  // 2. Missing / already-deleted group → 404
  it('should throw 404 when the group is missing or already deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: GROUP_ID, isDeleted: true });

    await expect(deleteWarrantyGroup(GROUP_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'warranty_group_not_found' });
    await expect(deleteWarrantyGroup(GROUP_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'warranty_group_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 3. A DELETE audit entry is written
  it('should log a DELETE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: GROUP_ID, isDeleted: false });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await deleteWarrantyGroup(GROUP_ID, mockReq());

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', resource: 'WarrantyGroup', details: { id: GROUP_ID } }));
  });
});
