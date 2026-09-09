import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockCrud = {
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
};
const mockLogAudit = jest.fn();
const mockActorFromReq = jest.fn(() => ({ userId: 'admin-id', ip: '127.0.0.1' }));

jest.unstable_mockModule('../../services/crud.service.js', () => ({ default: () => mockCrud }));
jest.unstable_mockModule('../../utils/auditLogger.js', () => ({ logAudit: mockLogAudit, actorFromReq: mockActorFromReq }));

const {
  listFaqs, getFaqById, createFaq, updateFaq, deleteFaq,
} = await import('../../services/faq.service.js');

const FAQ_ID = '64a1f0c2e4b0a1b2c3d4e5f6';
const mockReq = (body = {}, extra = {}) => ({ body, ip: '127.0.0.1', user: { _id: 'admin-id' }, ...extra });

describe('Faqs — listFaqs', () => {
  // 1. Default listing filters out soft-deleted rows, sorted by order then newest, 50 per page
  it('should query non-deleted faqs sorted by order/createdAt with limit 50', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listFaqs();

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith(
      { isDeleted: false },
      { page: 1, limit: 50, sort: { order: 1, createdAt: -1 } },
    );
  });

  // 2. Pagination values are forwarded as given
  it('should forward page and limit', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listFaqs({ page: 2, limit: 5 });

    expect(mockCrud.findAndCountAll.mock.calls[0][1]).toMatchObject({ page: 2, limit: 5 });
  });

  // 3. The crud result is returned untouched
  it('should return the paginated result from crud', async () => {
    const paged = { count: 1, rows: [{ _id: FAQ_ID }] };
    mockCrud.findAndCountAll.mockResolvedValue(paged);

    const result = await listFaqs();

    expect(result).toBe(paged);
  });
});

describe('Faqs — getFaqById', () => {
  // 1. Found faq is returned
  it('should return the faq when found and not deleted', async () => {
    const faq = { _id: FAQ_ID, question: 'Q?', isDeleted: false };
    mockCrud.findByPk.mockResolvedValue(faq);

    const result = await getFaqById(FAQ_ID);

    expect(mockCrud.findByPk).toHaveBeenCalledWith(FAQ_ID);
    expect(result).toBe(faq);
  });

  // 2. Missing faq → 404
  it('should throw 404 faq_not_found when nothing matches', async () => {
    mockCrud.findByPk.mockResolvedValue(null);

    await expect(getFaqById(FAQ_ID)).rejects.toMatchObject({ status: 404, code: 'faq_not_found' });
  });

  // 3. Soft-deleted faq is treated as missing
  it('should throw 404 when the faq is soft-deleted', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: FAQ_ID, isDeleted: true });

    await expect(getFaqById(FAQ_ID)).rejects.toMatchObject({ status: 404, code: 'faq_not_found' });
  });
});

describe('Faqs — createFaq', () => {
  // 1. Whitelisted fields are forwarded exactly as given
  it('should create the faq from the whitelisted body fields', async () => {
    mockCrud.create.mockImplementation(async (data) => ({ _id: FAQ_ID, ...data }));

    const result = await createFaq(mockReq({ question: 'How long?', answer: '2 days', order: 3, isActive: false }));

    expect(mockCrud.create).toHaveBeenCalledWith({ question: 'How long?', answer: '2 days', order: 3, isActive: false });
    expect(result._id).toBe(FAQ_ID);
  });

  // 2. Non-whitelisted keys never reach the database (isDeleted, _id, createdAt, ...)
  it('should drop non-whitelisted keys on create (no isDeleted/_id mass-assignment)', async () => {
    mockCrud.create.mockResolvedValue({ _id: FAQ_ID });

    await createFaq(mockReq({ question: 'Q', answer: 'A', isDeleted: true, _id: 'hack', createdAt: 'x' }));

    expect(mockCrud.create).toHaveBeenCalledWith({ question: 'Q', answer: 'A' });
  });

  // 3. Omitted optional fields are left out so schema defaults apply; explicit falsy values are kept
  it('should omit undefined fields but keep explicit falsy values', async () => {
    mockCrud.create.mockResolvedValue({ _id: FAQ_ID });

    await createFaq(mockReq({ question: 'Q', answer: 'A', order: 0, isActive: false }));
    await createFaq(mockReq({ question: 'Q', answer: 'A' }));

    expect(mockCrud.create.mock.calls[0][0]).toEqual({ question: 'Q', answer: 'A', order: 0, isActive: false });
    expect(mockCrud.create.mock.calls[1][0]).toEqual({ question: 'Q', answer: 'A' });
  });

  // 4. A CREATE audit entry is written for the acting admin
  it('should log a CREATE audit entry with the actor and faq id', async () => {
    mockCrud.create.mockResolvedValue({ _id: FAQ_ID });
    const req = mockReq({ question: 'Q', answer: 'A' });

    await createFaq(req);

    expect(mockActorFromReq).toHaveBeenCalledWith(req);
    expect(mockLogAudit).toHaveBeenCalledWith({
      userId: 'admin-id', ip: '127.0.0.1', action: 'CREATE', resource: 'Faq', details: { id: FAQ_ID },
    });
  });
});

describe('Faqs — updateFaq', () => {
  const existing = { _id: FAQ_ID, question: 'Orig', answer: 'A', order: 0, isActive: true, isDeleted: false };

  // 1. Only whitelisted fields reach the database
  it('should update only whitelisted fields (no isDeleted/_id mass-assignment)', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue({ ...existing, question: 'New' });

    const result = await updateFaq(FAQ_ID, mockReq({ question: 'New', order: 2, isDeleted: true, _id: 'hack' }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: FAQ_ID }, { question: 'New', order: 2 });
    expect(result).toEqual({ ...existing, question: 'New' });
  });

  // 2. Explicit falsy values (isActive false, order 0) are persisted
  it('should persist explicit falsy values', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateFaq(FAQ_ID, mockReq({ isActive: false, order: 0 }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: FAQ_ID }, { isActive: false, order: 0 });
  });

  // 3. An empty body results in an empty update (no-op write)
  it('should write an empty update object when the body has no whitelisted keys', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateFaq(FAQ_ID, mockReq({}));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: FAQ_ID }, {});
  });

  // 4. Missing / deleted faq → 404 and no write
  it('should throw 404 and not write when the faq is missing or deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...existing, isDeleted: true });

    await expect(updateFaq(FAQ_ID, mockReq({ question: 'x' }))).rejects.toMatchObject({ status: 404, code: 'faq_not_found' });
    await expect(updateFaq(FAQ_ID, mockReq({ question: 'x' }))).rejects.toMatchObject({ status: 404, code: 'faq_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  // 5. An UPDATE audit entry is written
  it('should log an UPDATE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateFaq(FAQ_ID, mockReq({ answer: 'B' }));

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', resource: 'Faq', details: { id: FAQ_ID } }));
  });
});

describe('Faqs — deleteFaq', () => {
  // 1. Soft delete: mark deleted and deactivate
  it('should soft-delete the faq and deactivate it', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: FAQ_ID, isDeleted: false });
    mockCrud.findOneAndUpdate.mockResolvedValue({ _id: FAQ_ID, isDeleted: true, isActive: false });

    const result = await deleteFaq(FAQ_ID, mockReq());

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: FAQ_ID }, { isDeleted: true, isActive: false });
    expect(result).toEqual({ _id: FAQ_ID, isDeleted: true, isActive: false });
  });

  // 2. Missing / already-deleted faq → 404
  it('should throw 404 when the faq is missing or already deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: FAQ_ID, isDeleted: true });

    await expect(deleteFaq(FAQ_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'faq_not_found' });
    await expect(deleteFaq(FAQ_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'faq_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 3. A DELETE audit entry is written
  it('should log a DELETE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: FAQ_ID, isDeleted: false });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await deleteFaq(FAQ_ID, mockReq());

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', resource: 'Faq', details: { id: FAQ_ID } }));
  });
});
