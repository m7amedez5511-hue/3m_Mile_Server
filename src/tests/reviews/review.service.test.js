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
  listReviews, getReviewById, createReview, updateReview, deleteReview,
} = await import('../../services/review.service.js');

const REVIEW_ID = '64a1f0c2e4b0a1b2c3d4e5f6';
const uploadedFile = { url: 'https://cdn/shot.png', publicId: 'reviews/shot', width: 10, height: 10 };
const mockReq = (body = {}, extra = {}) => ({ body, ip: '127.0.0.1', user: { _id: 'admin-id' }, ...extra });

describe('Reviews — listReviews', () => {
  // 1. Default listing filters out soft-deleted rows, page 1 / limit 50, sorted by order then newest
  it('should query non-deleted reviews sorted by order then createdAt with default pagination', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listReviews();

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith(
      { isDeleted: false },
      { page: 1, limit: 50, sort: { order: 1, createdAt: -1 } },
    );
  });

  // 2. isActive is only applied when explicitly passed
  it('should apply isActive when provided and skip it when undefined', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listReviews({ isActive: true });
    await listReviews({ isActive: false });
    await listReviews({ isActive: undefined });

    expect(mockCrud.findAndCountAll.mock.calls[0][0]).toEqual({ isDeleted: false, isActive: true });
    expect(mockCrud.findAndCountAll.mock.calls[1][0]).toEqual({ isDeleted: false, isActive: false });
    expect(mockCrud.findAndCountAll.mock.calls[2][0]).toEqual({ isDeleted: false });
  });

  // 3. Pagination values are forwarded as given
  it('should forward page and limit', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listReviews({ page: 4, limit: 12 });

    expect(mockCrud.findAndCountAll.mock.calls[0][1]).toMatchObject({ page: 4, limit: 12 });
  });

  // 4. The crud result is returned untouched
  it('should return the crud result as-is', async () => {
    const payload = { count: 1, rows: [{ _id: REVIEW_ID }] };
    mockCrud.findAndCountAll.mockResolvedValue(payload);

    const result = await listReviews();

    expect(result).toBe(payload);
  });
});

describe('Reviews — getReviewById', () => {
  // 1. Found review is returned
  it('should return the review when found and not deleted', async () => {
    const review = { _id: REVIEW_ID, alt: 'Great', isDeleted: false };
    mockCrud.findByPk.mockResolvedValue(review);

    const result = await getReviewById(REVIEW_ID);

    expect(mockCrud.findByPk).toHaveBeenCalledWith(REVIEW_ID);
    expect(result).toBe(review);
  });

  // 2. Missing review → 404
  it('should throw 404 review_not_found when nothing matches', async () => {
    mockCrud.findByPk.mockResolvedValue(null);

    await expect(getReviewById(REVIEW_ID)).rejects.toMatchObject({ status: 404, code: 'review_not_found' });
  });

  // 3. Soft-deleted review is treated as missing
  it('should throw 404 when the review is soft-deleted', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: REVIEW_ID, isDeleted: true });

    await expect(getReviewById(REVIEW_ID)).rejects.toMatchObject({ status: 404, code: 'review_not_found' });
  });
});

describe('Reviews — createReview', () => {
  // 1. Missing screenshot → 400 and nothing is written
  it('should throw 400 image_is_required when no file was uploaded', async () => {
    await expect(createReview(mockReq({ alt: 'x' }))).rejects.toMatchObject({ status: 400, code: 'image_is_required' });
    expect(mockCrud.create).not.toHaveBeenCalled();
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  // 2. Defaults are applied and the upload is mapped to image/imagePublicId
  it('should map the uploaded file and apply order/isActive defaults', async () => {
    mockCrud.create.mockImplementation(async (data) => ({ _id: REVIEW_ID, ...data }));

    const result = await createReview(mockReq({ alt: 'Five stars' }, { uploadedFile }));

    expect(mockCrud.create).toHaveBeenCalledWith({
      image: 'https://cdn/shot.png',
      imagePublicId: 'reviews/shot',
      alt: 'Five stars',
      order: 0,
      isActive: true,
    });
    expect(result._id).toBe(REVIEW_ID);
  });

  // 3. Explicit values override defaults (including falsy 0 / false)
  it('should keep explicit order and isActive values', async () => {
    mockCrud.create.mockResolvedValue({ _id: REVIEW_ID });

    await createReview(mockReq({ alt: 'A', order: 5, isActive: false }, { uploadedFile }));

    expect(mockCrud.create.mock.calls[0][0]).toMatchObject({ order: 5, isActive: false });
  });

  // 4. Non-whitelisted body keys are never written
  it('should ignore extra body keys such as isDeleted or image', async () => {
    mockCrud.create.mockResolvedValue({ _id: REVIEW_ID });

    await createReview(mockReq({ alt: 'A', isDeleted: true, image: 'hack.png', imagePublicId: 'hack' }, { uploadedFile }));

    expect(mockCrud.create.mock.calls[0][0]).toEqual({
      image: 'https://cdn/shot.png', imagePublicId: 'reviews/shot', alt: 'A', order: 0, isActive: true,
    });
  });

  // 5. A CREATE audit entry is written for the acting admin
  it('should log a CREATE audit entry with the actor and review id', async () => {
    mockCrud.create.mockResolvedValue({ _id: REVIEW_ID });
    const req = mockReq({ alt: 'A' }, { uploadedFile });

    await createReview(req);

    expect(mockActorFromReq).toHaveBeenCalledWith(req);
    expect(mockLogAudit).toHaveBeenCalledWith({
      userId: 'admin-id', ip: '127.0.0.1', action: 'CREATE', resource: 'Review', details: { id: REVIEW_ID },
    });
  });
});

describe('Reviews — updateReview', () => {
  const existing = { _id: REVIEW_ID, alt: 'Orig', imagePublicId: 'reviews/old', isDeleted: false };

  // 1. Only whitelisted fields reach the database
  it('should update only whitelisted fields (no image/isDeleted mass-assignment)', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue({ ...existing, alt: 'New' });

    const result = await updateReview(REVIEW_ID, mockReq({ alt: 'New', order: 2, isActive: false, isDeleted: true, image: 'x', imagePublicId: 'y' }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: REVIEW_ID }, { alt: 'New', order: 2, isActive: false });
    expect(mockSafeDelete).not.toHaveBeenCalled();
    expect(result).toEqual({ ...existing, alt: 'New' });
  });

  // 2. Missing / deleted review → 404 and no write
  it('should throw 404 and not write when the review is missing or deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...existing, isDeleted: true });

    await expect(updateReview(REVIEW_ID, mockReq({ alt: 'x' }))).rejects.toMatchObject({ status: 404, code: 'review_not_found' });
    await expect(updateReview(REVIEW_ID, mockReq({ alt: 'x' }))).rejects.toMatchObject({ status: 404, code: 'review_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  // 3. A new upload replaces the screenshot and deletes the old asset from Cloudinary
  it('should replace the image and delete the old Cloudinary asset', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateReview(REVIEW_ID, mockReq({}, { uploadedFile }));

    expect(mockSafeDelete).toHaveBeenCalledTimes(1);
    expect(mockSafeDelete).toHaveBeenCalledWith('reviews/old', { resource: 'Review', id: REVIEW_ID, reason: 'replaced_on_update' });
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: REVIEW_ID }, { image: 'https://cdn/shot.png', imagePublicId: 'reviews/shot' });
  });

  // 4. An empty body still performs a (no-op) update
  it('should call findOneAndUpdate with an empty patch when nothing updatable is sent', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateReview(REVIEW_ID, mockReq({}));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: REVIEW_ID }, {});
  });

  // 5. An UPDATE audit entry is written
  it('should log an UPDATE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const req = mockReq({ alt: 'x' });

    await updateReview(REVIEW_ID, req);

    expect(mockActorFromReq).toHaveBeenCalledWith(req);
    expect(mockLogAudit).toHaveBeenCalledWith({
      userId: 'admin-id', ip: '127.0.0.1', action: 'UPDATE', resource: 'Review', details: { id: REVIEW_ID },
    });
  });
});

describe('Reviews — deleteReview', () => {
  // 1. Soft delete: remove the Cloudinary asset, mark deleted, deactivate (image fields kept)
  it('should delete the screenshot from Cloudinary and soft-delete the review', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: REVIEW_ID, imagePublicId: 'reviews/old', isDeleted: false });
    mockCrud.findOneAndUpdate.mockResolvedValue({ _id: REVIEW_ID, isDeleted: true });

    const result = await deleteReview(REVIEW_ID, mockReq());

    expect(mockSafeDelete).toHaveBeenCalledWith('reviews/old', { resource: 'Review', id: REVIEW_ID, reason: 'review_deleted' });
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: REVIEW_ID }, { isDeleted: true, isActive: false });
    expect(result).toEqual({ _id: REVIEW_ID, isDeleted: true });
  });

  // 2. Cloudinary cleanup happens before the database write
  it('should await the Cloudinary deletion before writing the soft-delete', async () => {
    const order = [];
    mockCrud.findByPk.mockResolvedValue({ _id: REVIEW_ID, imagePublicId: 'p', isDeleted: false });
    mockSafeDelete.mockImplementation(async () => { order.push('cloudinary'); });
    mockCrud.findOneAndUpdate.mockImplementation(async () => { order.push('db'); return {}; });

    await deleteReview(REVIEW_ID, mockReq());

    expect(order).toEqual(['cloudinary', 'db']);
  });

  // 3. Missing / already-deleted review → 404 and no Cloudinary call
  it('should throw 404 when the review is missing or already deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: REVIEW_ID, isDeleted: true });

    await expect(deleteReview(REVIEW_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'review_not_found' });
    await expect(deleteReview(REVIEW_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'review_not_found' });
    expect(mockSafeDelete).not.toHaveBeenCalled();
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 4. A DELETE audit entry is written
  it('should log a DELETE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: REVIEW_ID, imagePublicId: 'p', isDeleted: false });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await deleteReview(REVIEW_ID, mockReq());

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', resource: 'Review', details: { id: REVIEW_ID } }));
  });
});
