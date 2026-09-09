import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockCrud = {
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
};
const mockSafeDelete = jest.fn().mockResolvedValue(undefined);
const mockLogAudit = jest.fn();
const mockActorFromReq = jest.fn(() => ({ userId: 'admin-id', ip: '127.0.0.1' }));

jest.unstable_mockModule('../../services/crud.service.js', () => ({ default: () => mockCrud }));
jest.unstable_mockModule('../../utils/softDeleteImage.js', () => ({ safeDeleteCloudinaryImage: mockSafeDelete }));
jest.unstable_mockModule('../../utils/auditLogger.js', () => ({ logAudit: mockLogAudit, actorFromReq: mockActorFromReq }));

const {
  listBranches, getBranchById, createBranch, updateBranch, deleteBranch,
} = await import('../../services/branch.service.js');

const BRANCH_ID = '64a1f0c2e4b0a1b2c3d4e5f8';
const mockReq = (body = {}, extra = {}) => ({ body, ip: '127.0.0.1', user: { _id: 'admin-id' }, ...extra });

describe('Branches — listBranches', () => {
  // 1. Default listing filters out soft-deleted rows, sorted by order then newest-first
  it('should query non-deleted branches sorted by order and createdAt', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listBranches();

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith(
      { isDeleted: false },
      { page: 1, limit: 10, sort: { order: 1, createdAt: -1 } },
    );
  });

  // 2. City filter is an escaped case-insensitive regex
  it('should add an escaped case-insensitive city regex when city is provided', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listBranches({ city: 'Riyadh (north)' });

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith(
      { isDeleted: false, city: { $regex: 'Riyadh \\(north\\)', $options: 'i' } },
      expect.any(Object),
    );
  });

  // 3. Blank city must not add a filter
  it('should ignore a blank city string', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listBranches({ city: '   ' });

    expect(mockCrud.findAndCountAll.mock.calls[0][0]).toEqual({ isDeleted: false });
  });

  // 4. Pagination values are forwarded as given
  it('should forward page and limit', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listBranches({ page: 2, limit: 50 });

    expect(mockCrud.findAndCountAll.mock.calls[0][1]).toMatchObject({ page: 2, limit: 50 });
  });
});

describe('Branches — getBranchById', () => {
  // 1. Found branch is returned
  it('should return the branch when found and not deleted', async () => {
    const branch = { _id: BRANCH_ID, name: 'Main', isDeleted: false };
    mockCrud.findByPk.mockResolvedValue(branch);

    const result = await getBranchById(BRANCH_ID);

    expect(mockCrud.findByPk).toHaveBeenCalledWith(BRANCH_ID);
    expect(result).toBe(branch);
  });

  // 2. Missing branch → 404
  it('should throw 404 branch_not_found when nothing matches', async () => {
    mockCrud.findByPk.mockResolvedValue(null);

    await expect(getBranchById(BRANCH_ID)).rejects.toMatchObject({ status: 404, code: 'branch_not_found' });
  });

  // 3. Soft-deleted branch is treated as missing
  it('should throw 404 when the branch is soft-deleted', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: BRANCH_ID, isDeleted: true });

    await expect(getBranchById(BRANCH_ID)).rejects.toMatchObject({ status: 404, code: 'branch_not_found' });
  });
});

describe('Branches — createBranch', () => {
  // 1. Defaults are applied and the pin is nested by hand from the dotted body keys
  it('should apply defaults, nest location and pin, and create the branch', async () => {
    mockCrud.create.mockImplementation(async (data) => ({ _id: BRANCH_ID, ...data }));

    const result = await createBranch(mockReq({ name: 'Main' }));

    expect(mockCrud.create).toHaveBeenCalledWith({
      name: 'Main',
      city: undefined,
      address: undefined,
      phone: undefined,
      whatsapp: undefined,
      location: { lat: undefined, lng: undefined },
      mapUrl: undefined,
      workingHours: undefined,
      pin: { top: '', start: '' },
      order: 0,
      isActive: true,
    });
    expect(Object.keys(mockCrud.create.mock.calls[0][0])).not.toContain('pin.top');
    expect(result._id).toBe(BRANCH_ID);
  });

  // 2. Explicit values are kept, including dotted pin keys mapped into the nested pin
  it('should keep explicit fields and map pin.top/pin.start into pin', async () => {
    mockCrud.create.mockResolvedValue({ _id: BRANCH_ID });

    await createBranch(mockReq({
      name: 'Main', city: 'Riyadh', address: 'Street 1', phone: '0500', whatsapp: '0501',
      lat: 24.7, lng: 46.6, mapUrl: 'https://maps.example/x', workingHours: '9-5',
      'pin.top': '58%', 'pin.start': '12.5%', order: 3, isActive: false,
    }));

    expect(mockCrud.create).toHaveBeenCalledWith({
      name: 'Main', city: 'Riyadh', address: 'Street 1', phone: '0500', whatsapp: '0501',
      location: { lat: 24.7, lng: 46.6 }, mapUrl: 'https://maps.example/x', workingHours: '9-5',
      pin: { top: '58%', start: '12.5%' }, order: 3, isActive: false,
    });
  });

  // 3. Non-whitelisted body keys never reach the database
  it('should ignore isDeleted, image and imagePublicId supplied in the body', async () => {
    mockCrud.create.mockResolvedValue({ _id: BRANCH_ID });

    await createBranch(mockReq({ name: 'Main', isDeleted: true, image: 'https://evil/x.png', imagePublicId: 'evil' }));

    const data = mockCrud.create.mock.calls[0][0];
    expect(data).not.toHaveProperty('isDeleted');
    expect(data).not.toHaveProperty('image');
    expect(data).not.toHaveProperty('imagePublicId');
  });

  // 4. An uploaded file sets image and imagePublicId
  it('should attach the uploaded image url and publicId', async () => {
    mockCrud.create.mockResolvedValue({ _id: BRANCH_ID });

    await createBranch(mockReq({ name: 'Main' }, { uploadedFile: { url: 'https://cdn/b.png', publicId: 'b', width: 1, height: 1 } }));

    expect(mockCrud.create.mock.calls[0][0]).toMatchObject({ image: 'https://cdn/b.png', imagePublicId: 'b' });
  });

  // 5. A CREATE audit entry is written for the acting admin
  it('should log a CREATE audit entry with the actor and branch id', async () => {
    mockCrud.create.mockResolvedValue({ _id: BRANCH_ID });
    const req = mockReq({ name: 'Main' });

    await createBranch(req);

    expect(mockActorFromReq).toHaveBeenCalledWith(req);
    expect(mockLogAudit).toHaveBeenCalledWith({
      userId: 'admin-id', ip: '127.0.0.1', action: 'CREATE', resource: 'Branch', details: { id: BRANCH_ID, name: 'Main' },
    });
  });
});

describe('Branches — updateBranch', () => {
  const existing = {
    _id: BRANCH_ID, name: 'Orig', location: { lat: 24.7, lng: 46.6 }, imagePublicId: null, isDeleted: false,
  };

  // 1. Only whitelisted fields reach the database; dotted pin keys pass through as-is
  it('should update only whitelisted fields (no isDeleted/image/imagePublicId mass-assignment)', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue({ ...existing, name: 'New' });

    const result = await updateBranch(BRANCH_ID, mockReq({
      name: 'New', city: 'Jeddah', address: 'A', phone: 'P', whatsapp: 'W', mapUrl: '', workingHours: 'H',
      order: 2, isActive: false, 'pin.top': '10%', 'pin.start': '20%',
      isDeleted: true, image: 'https://evil/x.png', imagePublicId: 'evil', createdAt: 'x',
    }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: BRANCH_ID }, {
      name: 'New', city: 'Jeddah', address: 'A', phone: 'P', whatsapp: 'W', mapUrl: '', workingHours: 'H',
      order: 2, isActive: false, 'pin.top': '10%', 'pin.start': '20%',
    });
    expect(result).toEqual({ ...existing, name: 'New' });
  });

  // 2. Missing / deleted branch → 404 and no write
  it('should throw 404 and not write when the branch is missing or deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...existing, isDeleted: true });

    await expect(updateBranch(BRANCH_ID, mockReq({ name: 'x' }))).rejects.toMatchObject({ status: 404, code: 'branch_not_found' });
    await expect(updateBranch(BRANCH_ID, mockReq({ name: 'x' }))).rejects.toMatchObject({ status: 404, code: 'branch_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 3. Providing only one half of the coordinates merges with the stored half
  it('should merge a partial lat/lng with the existing location', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateBranch(BRANCH_ID, mockReq({ lat: 25 }));
    await updateBranch(BRANCH_ID, mockReq({ lng: 47 }));
    await updateBranch(BRANCH_ID, mockReq({ lat: 1, lng: 2 }));

    expect(mockCrud.findOneAndUpdate.mock.calls[0][1]).toEqual({ location: { lat: 25, lng: 46.6 } });
    expect(mockCrud.findOneAndUpdate.mock.calls[1][1]).toEqual({ location: { lat: 24.7, lng: 47 } });
    expect(mockCrud.findOneAndUpdate.mock.calls[2][1]).toEqual({ location: { lat: 1, lng: 2 } });
  });

  // 4. Location is untouched when neither coordinate is sent, and tolerates a missing stored location
  it('should leave location out when lat/lng are omitted and tolerate a missing existing location', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(existing).mockResolvedValueOnce({ ...existing, location: undefined });
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateBranch(BRANCH_ID, mockReq({ name: 'x' }));
    await updateBranch(BRANCH_ID, mockReq({ lat: 5 }));

    expect(mockCrud.findOneAndUpdate.mock.calls[0][1]).toEqual({ name: 'x' });
    expect(mockCrud.findOneAndUpdate.mock.calls[1][1]).toEqual({ location: { lat: 5, lng: undefined } });
  });

  // 5. A new upload replaces the image and deletes the old asset from Cloudinary
  it('should replace the image and delete the previous asset when one exists', async () => {
    mockCrud.findByPk.mockResolvedValue({ ...existing, imagePublicId: 'old' });
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateBranch(BRANCH_ID, mockReq({}, { uploadedFile: { url: 'https://cdn/new.png', publicId: 'new' } }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: BRANCH_ID }, { image: 'https://cdn/new.png', imagePublicId: 'new' });
    expect(mockSafeDelete).toHaveBeenCalledTimes(1);
    expect(mockSafeDelete).toHaveBeenCalledWith('old', { resource: 'Branch', id: BRANCH_ID, reason: 'replaced_on_update' });
  });

  // 6. No Cloudinary deletion when the branch had no image before
  it('should not call Cloudinary when there was no previous image', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateBranch(BRANCH_ID, mockReq({}, { uploadedFile: { url: 'https://cdn/new.png', publicId: 'new' } }));

    expect(mockSafeDelete).not.toHaveBeenCalled();
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: BRANCH_ID }, { image: 'https://cdn/new.png', imagePublicId: 'new' });
  });

  // 7. An UPDATE audit entry is written
  it('should log an UPDATE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateBranch(BRANCH_ID, mockReq({ name: 'x' }));

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', resource: 'Branch', details: { id: BRANCH_ID } }));
  });
});

describe('Branches — deleteBranch', () => {
  // 1. Soft delete: mark deleted, deactivate, clear publicId and remove the asset
  it('should soft-delete the branch and delete its image from Cloudinary', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: BRANCH_ID, isDeleted: false, imagePublicId: 'img' });
    mockCrud.findOneAndUpdate.mockResolvedValue({ _id: BRANCH_ID, isDeleted: true });

    const result = await deleteBranch(BRANCH_ID, mockReq());

    expect(mockSafeDelete).toHaveBeenCalledTimes(1);
    expect(mockSafeDelete).toHaveBeenCalledWith('img', { resource: 'Branch', id: BRANCH_ID, reason: 'branch_deleted' });
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: BRANCH_ID }, { isDeleted: true, isActive: false, imagePublicId: null });
    expect(result).toEqual({ _id: BRANCH_ID, isDeleted: true });
  });

  // 2. No Cloudinary call when the branch has no image
  it('should skip Cloudinary when the branch has no image', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: BRANCH_ID, isDeleted: false, imagePublicId: null });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await deleteBranch(BRANCH_ID, mockReq());

    expect(mockSafeDelete).not.toHaveBeenCalled();
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: BRANCH_ID }, { isDeleted: true, isActive: false, imagePublicId: null });
  });

  // 3. Missing / already-deleted branch → 404
  it('should throw 404 when the branch is missing or already deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: BRANCH_ID, isDeleted: true });

    await expect(deleteBranch(BRANCH_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'branch_not_found' });
    await expect(deleteBranch(BRANCH_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'branch_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 4. A DELETE audit entry is written
  it('should log a DELETE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: BRANCH_ID, isDeleted: false });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await deleteBranch(BRANCH_ID, mockReq());

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', resource: 'Branch', details: { id: BRANCH_ID } }));
  });
});
