import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockCrud = {
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
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
  listPartners, getPartnerById, createPartner, updatePartner, deletePartner,
} = await import('../../services/partner.service.js');

const PARTNER_ID = '64a1f0c2e4b0a1b2c3d4e5f6';
const uploadedFile = { url: 'https://cdn/logo.png', publicId: 'logo-1', width: 100, height: 50 };
const mockReq = (body = {}, extra = {}) => ({ body, ip: '127.0.0.1', user: { _id: 'admin-id' }, ...extra });

describe('Partners — listPartners', () => {
  // 1. Default listing filters out soft-deleted rows, sorts by order then newest, default limit 50, no populate
  it('should query non-deleted partners sorted by order/createdAt with a default limit of 50', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listPartners();

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith(
      { isDeleted: false },
      { page: 1, limit: 50, sort: { order: 1, createdAt: -1 } },
    );
  });

  // 2. Pagination values are forwarded as given
  it('should forward page and limit', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listPartners({ page: 2, limit: 10 });

    expect(mockCrud.findAndCountAll.mock.calls[0][1]).toEqual({ page: 2, limit: 10, sort: { order: 1, createdAt: -1 } });
  });

  // 3. The crud result is returned untouched
  it('should return the crud result', async () => {
    const payload = { count: 1, rows: [{ _id: PARTNER_ID }] };
    mockCrud.findAndCountAll.mockResolvedValue(payload);

    await expect(listPartners()).resolves.toBe(payload);
  });
});

describe('Partners — getPartnerById', () => {
  // 1. Found partner is returned (no populate)
  it('should return the partner when found and not deleted', async () => {
    const partner = { _id: PARTNER_ID, name: 'Toyota', isDeleted: false };
    mockCrud.findByPk.mockResolvedValue(partner);

    const result = await getPartnerById(PARTNER_ID);

    expect(mockCrud.findByPk).toHaveBeenCalledWith(PARTNER_ID);
    expect(result).toBe(partner);
  });

  // 2. Missing partner → 404
  it('should throw 404 partner_not_found when nothing matches', async () => {
    mockCrud.findByPk.mockResolvedValue(null);

    await expect(getPartnerById(PARTNER_ID)).rejects.toMatchObject({ status: 404, code: 'partner_not_found' });
  });

  // 3. Soft-deleted partner is treated as missing
  it('should throw 404 when the partner is soft-deleted', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: PARTNER_ID, isDeleted: true });

    await expect(getPartnerById(PARTNER_ID)).rejects.toMatchObject({ status: 404, code: 'partner_not_found' });
  });
});

describe('Partners — createPartner', () => {
  // 1. Logo is mandatory: no upload → 400 and nothing is written
  it('should throw 400 logo_is_required and not write when no logo was uploaded', async () => {
    await expect(createPartner(mockReq({ name: 'Toyota' }))).rejects.toMatchObject({ status: 400, code: 'logo_is_required' });

    expect(mockCrud.create).not.toHaveBeenCalled();
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  // 2. Defaults are applied and the logo comes from the upload
  it('should create the partner with logo/logoPublicId from the upload and default order/isActive', async () => {
    mockCrud.create.mockImplementation(async (data) => ({ _id: PARTNER_ID, ...data }));

    const result = await createPartner(mockReq({ name: 'Toyota' }, { uploadedFile }));

    expect(mockCrud.create).toHaveBeenCalledWith({
      name: 'Toyota',
      logo: 'https://cdn/logo.png',
      logoPublicId: 'logo-1',
      order: 0,
      isActive: true,
    });
    expect(result._id).toBe(PARTNER_ID);
  });

  // 3. Explicit values override defaults (0 order / false isActive preserved)
  it('should keep explicit order and isActive', async () => {
    mockCrud.create.mockResolvedValue({ _id: PARTNER_ID });

    await createPartner(mockReq({ name: 'Honda', order: 5, isActive: false }, { uploadedFile }));

    expect(mockCrud.create.mock.calls[0][0]).toMatchObject({ order: 5, isActive: false });
  });

  // 4. Non-whitelisted body keys are not persisted (logo fields come only from the upload)
  it('should ignore isDeleted/logo/logoPublicId from the body', async () => {
    mockCrud.create.mockResolvedValue({ _id: PARTNER_ID });

    await createPartner(mockReq({ name: 'Nissan', isDeleted: true, logo: 'evil', logoPublicId: 'evil' }, { uploadedFile }));

    const data = mockCrud.create.mock.calls[0][0];
    expect(data).not.toHaveProperty('isDeleted');
    expect(data.logo).toBe('https://cdn/logo.png');
    expect(data.logoPublicId).toBe('logo-1');
  });

  // 5. A CREATE audit entry is written for the acting admin
  it('should log a CREATE audit entry with the actor, partner id and name', async () => {
    mockCrud.create.mockResolvedValue({ _id: PARTNER_ID });
    const req = mockReq({ name: 'Toyota' }, { uploadedFile });

    await createPartner(req);

    expect(mockActorFromReq).toHaveBeenCalledWith(req);
    expect(mockLogAudit).toHaveBeenCalledWith({
      userId: 'admin-id', ip: '127.0.0.1', action: 'CREATE', resource: 'Partner', details: { id: PARTNER_ID, name: 'Toyota' },
    });
  });
});

describe('Partners — updatePartner', () => {
  const existing = { _id: PARTNER_ID, name: 'Orig', logo: 'https://cdn/old.png', logoPublicId: 'old-logo', isDeleted: false };

  // 1. Only whitelisted fields reach the database
  it('should update only whitelisted fields (no isDeleted/logo/logoPublicId mass-assignment)', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue({ ...existing, name: 'New' });

    await updatePartner(PARTNER_ID, mockReq({ name: 'New', order: 2, isActive: false, isDeleted: true, logo: 'x', logoPublicId: 'y' }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: PARTNER_ID }, { name: 'New', order: 2, isActive: false });
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 2. Missing / deleted partner → 404 and no write
  it('should throw 404 and not write when the partner is missing or deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...existing, isDeleted: true });

    await expect(updatePartner(PARTNER_ID, mockReq({ name: 'x' }))).rejects.toMatchObject({ status: 404, code: 'partner_not_found' });
    await expect(updatePartner(PARTNER_ID, mockReq({ name: 'x' }))).rejects.toMatchObject({ status: 404, code: 'partner_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 3. Omitted fields are left alone (empty patch when nothing whitelisted is sent)
  it('should send an empty patch when no whitelisted field is present', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updatePartner(PARTNER_ID, mockReq({ foo: 'bar' }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: PARTNER_ID }, {});
  });

  // 4. A new upload replaces the logo and the old asset is deleted from Cloudinary
  it('should replace logo/logoPublicId and delete the old logo from Cloudinary', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updatePartner(PARTNER_ID, mockReq({ name: 'Renamed' }, { uploadedFile }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: PARTNER_ID },
      { name: 'Renamed', logo: 'https://cdn/logo.png', logoPublicId: 'logo-1' },
    );
    expect(mockSafeDelete).toHaveBeenCalledTimes(1);
    expect(mockSafeDelete).toHaveBeenCalledWith('old-logo', { resource: 'Partner', id: PARTNER_ID, reason: 'replaced_on_update' });
  });

  // 5. An UPDATE audit entry is written and the updated document is returned
  it('should log an UPDATE audit entry and return the updated partner', async () => {
    const updated = { ...existing, name: 'x' };
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(updated);

    const result = await updatePartner(PARTNER_ID, mockReq({ name: 'x' }));

    expect(result).toBe(updated);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', resource: 'Partner', details: { id: PARTNER_ID } }));
  });
});

describe('Partners — deletePartner', () => {
  // 1. Soft delete: mark deleted + inactive, keep the logo fields (schema requires them), remove the asset
  it('should soft-delete the partner and delete its logo from Cloudinary', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: PARTNER_ID, isDeleted: false, logoPublicId: 'logo' });
    mockCrud.findOneAndUpdate.mockResolvedValue({ _id: PARTNER_ID, isDeleted: true });

    const result = await deletePartner(PARTNER_ID, mockReq());

    expect(mockSafeDelete).toHaveBeenCalledTimes(1);
    expect(mockSafeDelete).toHaveBeenCalledWith('logo', { resource: 'Partner', id: PARTNER_ID, reason: 'partner_deleted' });
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: PARTNER_ID }, { isDeleted: true, isActive: false });
    expect(result).toEqual({ _id: PARTNER_ID, isDeleted: true });
  });

  // 2. Missing / already-deleted partner → 404
  it('should throw 404 when the partner is missing or already deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: PARTNER_ID, isDeleted: true });

    await expect(deletePartner(PARTNER_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'partner_not_found' });
    await expect(deletePartner(PARTNER_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'partner_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 3. A DELETE audit entry is written
  it('should log a DELETE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: PARTNER_ID, isDeleted: false, logoPublicId: 'logo' });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await deletePartner(PARTNER_ID, mockReq());

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', resource: 'Partner', details: { id: PARTNER_ID } }));
  });
});
