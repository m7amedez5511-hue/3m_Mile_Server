import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockCrud = {
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
};
const mockResolveSlug = jest.fn();
const mockSafeDelete = jest.fn().mockResolvedValue(undefined);
const mockLogAudit = jest.fn();
const mockActorFromReq = jest.fn(() => ({ userId: 'admin-id', ip: '127.0.0.1' }));

jest.unstable_mockModule('../../services/crud.service.js', () => ({ default: () => mockCrud }));
jest.unstable_mockModule('../../utils/buildSlugify.js', () => ({ resolveSlug: mockResolveSlug }));
jest.unstable_mockModule('../../utils/softDeleteImage.js', () => ({ safeDeleteCloudinaryImage: mockSafeDelete }));
jest.unstable_mockModule('../../utils/auditLogger.js', () => ({ logAudit: mockLogAudit, actorFromReq: mockActorFromReq }));

const {
  listPackages, getPackageById, createPackage, updatePackage, deletePackage, getPackageBySlug,
} = await import('../../services/package.service.js');

const PACKAGE_ID = '64a1f0c2e4b0a1b2c3d4e5f6';
const SERVICE_ID = '64a1f0c2e4b0a1b2c3d4e5f7';
const mockReq = (body = {}, extra = {}) => ({ body, ip: '127.0.0.1', user: { _id: 'admin-id' }, ...extra });

describe('Packages — listPackages', () => {
  // 1. Default listing filters out soft-deleted rows, sorts by order then newest and populates the service
  it('should query non-deleted packages sorted by order/createdAt with service populated', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listPackages();

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith(
      { isDeleted: false },
      { page: 1, limit: 10, sort: { order: 1, createdAt: -1 }, populate: [{ path: 'service' }] },
    );
  });

  // 2. activeOnly restricts to active packages
  it('should add isActive:true when activeOnly is truthy', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listPackages({ activeOnly: true });

    expect(mockCrud.findAndCountAll.mock.calls[0][0]).toEqual({ isDeleted: false, isActive: true });
  });

  // 3. A falsy activeOnly never adds an isActive filter (there is no "inactive only" mode)
  it('should not add an isActive filter when activeOnly is false or omitted', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listPackages({ activeOnly: false });
    await listPackages({ activeOnly: undefined });

    expect(mockCrud.findAndCountAll.mock.calls[0][0]).toEqual({ isDeleted: false });
    expect(mockCrud.findAndCountAll.mock.calls[1][0]).toEqual({ isDeleted: false });
  });

  // 4. Pagination values are forwarded as given
  it('should forward page and limit', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listPackages({ page: 2, limit: 5 });

    expect(mockCrud.findAndCountAll.mock.calls[0][1]).toMatchObject({ page: 2, limit: 5 });
  });
});

describe('Packages — getPackageById', () => {
  // 1. Found package is returned with the service populated
  it('should return the package when found and not deleted', async () => {
    const pkg = { _id: PACKAGE_ID, title: 'Gold', isDeleted: false };
    mockCrud.findByPk.mockResolvedValue(pkg);

    const result = await getPackageById(PACKAGE_ID);

    expect(mockCrud.findByPk).toHaveBeenCalledWith(PACKAGE_ID, { populate: [{ path: 'service' }] });
    expect(result).toBe(pkg);
  });

  // 2. Missing package → 404
  it('should throw 404 package_not_found when nothing matches', async () => {
    mockCrud.findByPk.mockResolvedValue(null);

    await expect(getPackageById(PACKAGE_ID)).rejects.toMatchObject({ status: 404, code: 'package_not_found' });
  });

  // 3. Soft-deleted package is treated as missing
  it('should throw 404 when the package is soft-deleted', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: PACKAGE_ID, isDeleted: true });

    await expect(getPackageById(PACKAGE_ID)).rejects.toMatchObject({ status: 404, code: 'package_not_found' });
  });
});

describe('Packages — getPackageBySlug', () => {
  // 1. Slug lookup excludes deleted rows and populates the service
  it('should look up by slug with isDeleted:false and return the document', async () => {
    const doc = { _id: PACKAGE_ID, slug: 'gold' };
    mockCrud.findOne.mockResolvedValue(doc);

    const result = await getPackageBySlug('gold');

    expect(mockCrud.findOne).toHaveBeenCalledWith({ slug: 'gold', isDeleted: false }, { populate: [{ path: 'service' }] });
    expect(result).toBe(doc);
  });

  // 2. Unknown slug → 404
  it('should throw 404 package_not_found for an unknown slug', async () => {
    mockCrud.findOne.mockResolvedValue(null);

    await expect(getPackageBySlug('nope')).rejects.toMatchObject({ status: 404, code: 'package_not_found' });
  });
});

describe('Packages — createPackage', () => {
  // 1. Defaults are applied and the slug is resolved from the title
  it('should resolve the slug, apply defaults and create the package', async () => {
    mockResolveSlug.mockResolvedValue('gold-wash');
    mockCrud.create.mockImplementation(async (data) => ({ _id: PACKAGE_ID, ...data }));

    const result = await createPackage(mockReq({ title: 'Gold Wash' }));

    expect(mockResolveSlug).toHaveBeenCalledWith('Package', undefined, 'Gold Wash');
    expect(mockCrud.create).toHaveBeenCalledWith({
      title: 'Gold Wash',
      slug: 'gold-wash',
      description: undefined,
      service: null,
      price: null,
      discountPercentage: null,
      startDate: null,
      endDate: null,
      order: 0,
      isActive: true,
    });
    expect(result._id).toBe(PACKAGE_ID);
  });

  // 2. An admin-supplied slug is passed through to resolveSlug
  it('should pass the admin-supplied slug to resolveSlug', async () => {
    mockResolveSlug.mockResolvedValue('custom');
    mockCrud.create.mockResolvedValue({ _id: PACKAGE_ID });

    await createPackage(mockReq({ title: 'Any', slug: 'custom' }));

    expect(mockResolveSlug).toHaveBeenCalledWith('Package', 'custom', 'Any');
    expect(mockCrud.create.mock.calls[0][0].slug).toBe('custom');
  });

  // 3. Explicit values override defaults (0 price / 0 discount / false isActive are preserved)
  it('should keep explicit description/service/price/discount/dates/order/isActive', async () => {
    mockResolveSlug.mockResolvedValue('p');
    mockCrud.create.mockResolvedValue({ _id: PACKAGE_ID });
    const startDate = new Date('2026-01-01');
    const endDate = new Date('2026-02-01');

    await createPackage(mockReq({
      title: 'P', description: 'd', service: SERVICE_ID, price: 0, discountPercentage: 0, startDate, endDate, order: 3, isActive: false,
    }));

    expect(mockCrud.create.mock.calls[0][0]).toMatchObject({
      description: 'd', service: SERVICE_ID, price: 0, discountPercentage: 0, startDate, endDate, order: 3, isActive: false,
    });
  });

  // 4. '' service is stored as null (unlinked)
  it("should map service '' to null", async () => {
    mockResolveSlug.mockResolvedValue('p');
    mockCrud.create.mockResolvedValue({ _id: PACKAGE_ID });

    await createPackage(mockReq({ title: 'P', service: '' }));

    expect(mockCrud.create.mock.calls[0][0].service).toBeNull();
  });

  // 5. Uploaded file is stored as flat image/imagePublicId fields
  it('should set image and imagePublicId from uploadedFile', async () => {
    mockResolveSlug.mockResolvedValue('p');
    mockCrud.create.mockResolvedValue({ _id: PACKAGE_ID });

    await createPackage(mockReq({ title: 'P' }, { uploadedFile: { url: 'https://cdn/p.png', publicId: 'pkg-1' } }));

    expect(mockCrud.create.mock.calls[0][0]).toMatchObject({ image: 'https://cdn/p.png', imagePublicId: 'pkg-1' });
  });

  // 6. Non-whitelisted body keys are not persisted
  it('should ignore isDeleted/imagePublicId from the body', async () => {
    mockResolveSlug.mockResolvedValue('p');
    mockCrud.create.mockResolvedValue({ _id: PACKAGE_ID });

    await createPackage(mockReq({ title: 'P', isDeleted: true, imagePublicId: 'evil', image: 'evil' }));

    const data = mockCrud.create.mock.calls[0][0];
    expect(data).not.toHaveProperty('isDeleted');
    expect(data).not.toHaveProperty('imagePublicId');
    expect(data).not.toHaveProperty('image');
  });

  // 7. A CREATE audit entry is written for the acting admin
  it('should log a CREATE audit entry with the actor, package id and title', async () => {
    mockResolveSlug.mockResolvedValue('p');
    mockCrud.create.mockResolvedValue({ _id: PACKAGE_ID });
    const req = mockReq({ title: 'P' });

    await createPackage(req);

    expect(mockActorFromReq).toHaveBeenCalledWith(req);
    expect(mockLogAudit).toHaveBeenCalledWith({
      userId: 'admin-id', ip: '127.0.0.1', action: 'CREATE', resource: 'Package', details: { id: PACKAGE_ID, title: 'P' },
    });
  });
});

describe('Packages — updatePackage', () => {
  const existing = { _id: PACKAGE_ID, title: 'Orig', slug: 'orig', isDeleted: false, imagePublicId: 'old-img' };

  // 1. Only whitelisted fields reach the database
  it('should update only whitelisted fields (no slug/isDeleted/image/imagePublicId mass-assignment)', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue({ ...existing, title: 'New' });

    await updatePackage(PACKAGE_ID, mockReq({
      title: 'New', price: 20, discountPercentage: 10, order: 2, isActive: false,
      isDeleted: true, image: 'x', imagePublicId: 'y', slug_hack: 'z',
    }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: PACKAGE_ID },
      { title: 'New', price: 20, discountPercentage: 10, order: 2, isActive: false },
    );
    expect(mockResolveSlug).not.toHaveBeenCalled();
  });

  // 2. Missing / deleted package → 404 and no write
  it('should throw 404 and not write when the package is missing or deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...existing, isDeleted: true });

    await expect(updatePackage(PACKAGE_ID, mockReq({ title: 'x' }))).rejects.toMatchObject({ status: 404, code: 'package_not_found' });
    await expect(updatePackage(PACKAGE_ID, mockReq({ title: 'x' }))).rejects.toMatchObject({ status: 404, code: 'package_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 3. '' service unsets it (null); a real id is kept; omitted service is untouched
  it("should map service '' to null, keep a real id and leave it out when omitted", async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updatePackage(PACKAGE_ID, mockReq({ service: '' }));
    await updatePackage(PACKAGE_ID, mockReq({ service: SERVICE_ID }));
    await updatePackage(PACKAGE_ID, mockReq({ title: 'x' }));

    expect(mockCrud.findOneAndUpdate.mock.calls[0][1]).toEqual({ service: null });
    expect(mockCrud.findOneAndUpdate.mock.calls[1][1]).toEqual({ service: SERVICE_ID });
    expect(mockCrud.findOneAndUpdate.mock.calls[2][1]).toEqual({ title: 'x' });
  });

  // 4. Slug is only re-resolved when a slug key is present in the body
  it('should re-resolve the slug only when req.body.slug is provided', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    mockResolveSlug.mockResolvedValue('renamed');

    await updatePackage(PACKAGE_ID, mockReq({ title: 'Renamed' }));
    expect(mockResolveSlug).not.toHaveBeenCalled();

    await updatePackage(PACKAGE_ID, mockReq({ slug: '' }));
    expect(mockResolveSlug).toHaveBeenCalledWith('Package', '', 'Orig', PACKAGE_ID);
    expect(mockCrud.findOneAndUpdate).toHaveBeenLastCalledWith({ _id: PACKAGE_ID }, { slug: 'renamed' });
  });

  // 5. When both slug and title are sent, the incoming title is the slug fallback
  it('should use the incoming title as the slug fallback when both are sent', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    mockResolveSlug.mockResolvedValue('new-title');

    await updatePackage(PACKAGE_ID, mockReq({ slug: 'new-title', title: 'New Title' }));

    expect(mockResolveSlug).toHaveBeenCalledWith('Package', 'new-title', 'New Title', PACKAGE_ID);
  });

  // 6. A new upload replaces the image and the old asset is deleted from Cloudinary
  it('should replace image/imagePublicId and delete the old asset from Cloudinary', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updatePackage(PACKAGE_ID, mockReq({}, { uploadedFile: { url: 'https://cdn/new.png', publicId: 'new-img' } }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: PACKAGE_ID }, { image: 'https://cdn/new.png', imagePublicId: 'new-img' });
    expect(mockSafeDelete).toHaveBeenCalledTimes(1);
    expect(mockSafeDelete).toHaveBeenCalledWith('old-img', { resource: 'Package', id: PACKAGE_ID, reason: 'replaced_on_update' });
  });

  // 7. Upload when there was no previous image → no Cloudinary deletion
  it('should skip Cloudinary deletion when the package had no image', async () => {
    mockCrud.findByPk.mockResolvedValue({ ...existing, imagePublicId: null });
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updatePackage(PACKAGE_ID, mockReq({}, { uploadedFile: { url: 'u', publicId: 'p' } }));

    expect(mockCrud.findOneAndUpdate.mock.calls[0][1]).toEqual({ image: 'u', imagePublicId: 'p' });
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 8. An UPDATE audit entry is written and the updated document is returned
  it('should log an UPDATE audit entry and return the updated package', async () => {
    const updated = { ...existing, title: 'x' };
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(updated);

    const result = await updatePackage(PACKAGE_ID, mockReq({ title: 'x' }));

    expect(result).toBe(updated);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', resource: 'Package', details: { id: PACKAGE_ID } }));
  });
});

describe('Packages — deletePackage', () => {
  // 1. Soft delete: mark deleted, deactivate, null the publicId and remove the asset
  it('should soft-delete the package and delete its image from Cloudinary', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: PACKAGE_ID, isDeleted: false, imagePublicId: 'img' });
    mockCrud.findOneAndUpdate.mockResolvedValue({ _id: PACKAGE_ID, isDeleted: true });

    const result = await deletePackage(PACKAGE_ID, mockReq());

    expect(mockSafeDelete).toHaveBeenCalledTimes(1);
    expect(mockSafeDelete).toHaveBeenCalledWith('img', { resource: 'Package', id: PACKAGE_ID, reason: 'package_deleted' });
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: PACKAGE_ID }, { isDeleted: true, isActive: false, imagePublicId: null });
    expect(result).toEqual({ _id: PACKAGE_ID, isDeleted: true });
  });

  // 2. No image → no Cloudinary call, still soft-deleted
  it('should skip Cloudinary when the package has no image', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: PACKAGE_ID, isDeleted: false, imagePublicId: null });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await deletePackage(PACKAGE_ID, mockReq());

    expect(mockSafeDelete).not.toHaveBeenCalled();
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: PACKAGE_ID }, { isDeleted: true, isActive: false, imagePublicId: null });
  });

  // 3. Missing / already-deleted package → 404
  it('should throw 404 when the package is missing or already deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: PACKAGE_ID, isDeleted: true });

    await expect(deletePackage(PACKAGE_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'package_not_found' });
    await expect(deletePackage(PACKAGE_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'package_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 4. A DELETE audit entry is written
  it('should log a DELETE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: PACKAGE_ID, isDeleted: false });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await deletePackage(PACKAGE_ID, mockReq());

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', resource: 'Package', details: { id: PACKAGE_ID } }));
  });
});
