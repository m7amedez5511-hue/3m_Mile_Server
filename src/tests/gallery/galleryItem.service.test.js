import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockCrud = {
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
};
const mockSafeDelete = jest.fn().mockResolvedValue(undefined);
const mockReplaceMedia = jest.fn();
const mockLogAudit = jest.fn();
const mockActorFromReq = jest.fn(() => ({ userId: 'admin-id', ip: '127.0.0.1' }));

jest.unstable_mockModule('../../services/crud.service.js', () => ({ default: () => mockCrud }));
jest.unstable_mockModule('../../utils/softDeleteImage.js', () => ({ safeDeleteCloudinaryImage: mockSafeDelete }));
jest.unstable_mockModule('../../utils/replaceCloudinaryMedia.js', () => ({ replaceCloudinaryMedia: mockReplaceMedia }));
jest.unstable_mockModule('../../utils/auditLogger.js', () => ({ logAudit: mockLogAudit, actorFromReq: mockActorFromReq }));

const {
  listGalleryItems, getGalleryItemById, createGalleryItem, updateGalleryItem, deleteGalleryItem,
} = await import('../../services/galleryItem.service.js');

const ITEM_ID = '64a1f0c2e4b0a1b2c3d4e5f6';
const SERVICE_ID = '64a1f0c2e4b0a1b2c3d4e5f7';
const YT_ID = 'dQw4w9WgXcQ';
const SERVICE_POPULATE = [{ path: 'service', localField: 'service', collection: 'services' }];
const mockReq = (body = {}, extra = {}) => ({ body, ip: '127.0.0.1', user: { _id: 'admin-id' }, ...extra });
const imageFile = { mimetype: 'image/png', buffer: Buffer.from('png') };
const videoFile = { mimetype: 'video/mp4', buffer: Buffer.from('mp4') };

describe('GalleryItems — listGalleryItems', () => {
  // 1. Default listing filters out soft-deleted rows, sorts by order then newest, populates the service
  it('should query non-deleted items sorted by order/createdAt with the service populated', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listGalleryItems();

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith(
      { isDeleted: false },
      { page: 1, limit: 12, sort: { order: 1, createdAt: -1 }, populate: SERVICE_POPULATE },
    );
  });

  // 2. Type filter is applied only when provided
  it('should add the type filter when provided and skip it when falsy', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listGalleryItems({ type: 'video' });
    await listGalleryItems({ type: '' });

    expect(mockCrud.findAndCountAll.mock.calls[0][0]).toEqual({ isDeleted: false, type: 'video' });
    expect(mockCrud.findAndCountAll.mock.calls[1][0]).toEqual({ isDeleted: false });
  });

  // 3. Service id must be cast to ObjectId for the aggregation $match
  it('should cast the service filter to an ObjectId', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listGalleryItems({ service: SERVICE_ID });

    const filter = mockCrud.findAndCountAll.mock.calls[0][0];
    expect(filter.service).not.toBe(SERVICE_ID);
    expect(String(filter.service)).toBe(SERVICE_ID);
  });

  // 4. Pagination values are forwarded as given
  it('should forward page and limit', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listGalleryItems({ page: 2, limit: 30 });

    expect(mockCrud.findAndCountAll.mock.calls[0][1]).toMatchObject({ page: 2, limit: 30 });
  });
});

describe('GalleryItems — getGalleryItemById', () => {
  // 1. Found item is returned with the service populated
  it('should return the item when found and not deleted', async () => {
    const item = { _id: ITEM_ID, type: 'image', isDeleted: false };
    mockCrud.findByPk.mockResolvedValue(item);

    const result = await getGalleryItemById(ITEM_ID);

    expect(mockCrud.findByPk).toHaveBeenCalledWith(ITEM_ID, { populate: SERVICE_POPULATE });
    expect(result).toBe(item);
  });

  // 2. Missing item → 404
  it('should throw 404 gallery_item_not_found when nothing matches', async () => {
    mockCrud.findByPk.mockResolvedValue(null);

    await expect(getGalleryItemById(ITEM_ID)).rejects.toMatchObject({ status: 404, code: 'gallery_item_not_found' });
  });

  // 3. Soft-deleted item is treated as missing
  it('should throw 404 when the item is soft-deleted', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: ITEM_ID, isDeleted: true });

    await expect(getGalleryItemById(ITEM_ID)).rejects.toMatchObject({ status: 404, code: 'gallery_item_not_found' });
  });
});

describe('GalleryItems — createGalleryItem', () => {
  const uploadedFile = { url: 'https://cdn/a.png', publicId: 'gallery/a', width: 10, height: 10 };

  // 1. Uploaded image: type comes from the route/mimetype param, defaults fill the rest
  it('should create an image item from the uploaded file with defaults applied', async () => {
    mockCrud.create.mockImplementation(async (data) => ({ _id: ITEM_ID, ...data }));

    const result = await createGalleryItem(mockReq({}, { uploadedFile }), 'image');

    expect(mockCrud.create).toHaveBeenCalledWith({
      title: '',
      type: 'image',
      url: 'https://cdn/a.png',
      publicId: 'gallery/a',
      externalId: '',
      description: '',
      alt: '',
      href: '',
      service: null,
      order: 0,
      isActive: true,
    });
    expect(result._id).toBe(ITEM_ID);
  });

  // 2. The body `type` is never trusted when a file is present — the resolved param wins
  it('should ignore body.type and use the resolved type when a file is uploaded', async () => {
    mockCrud.create.mockResolvedValue({ _id: ITEM_ID });

    await createGalleryItem(mockReq({ type: 'image' }, { uploadedFile }), 'video');

    expect(mockCrud.create.mock.calls[0][0].type).toBe('video');
  });

  // 3. Explicit metadata values override defaults
  it('should keep explicit title/description/alt/href/service/order/isActive', async () => {
    mockCrud.create.mockResolvedValue({ _id: ITEM_ID });

    await createGalleryItem(mockReq({
      title: 'Before/After', description: 'd', alt: 'a', href: '/services/x', service: SERVICE_ID, order: 3, isActive: false,
    }, { uploadedFile }), 'image');

    expect(mockCrud.create.mock.calls[0][0]).toMatchObject({
      title: 'Before/After', description: 'd', alt: 'a', href: '/services/x', service: SERVICE_ID, order: 3, isActive: false,
    });
  });

  // 4. YouTube reel: no file, externalId + body.type 'video' → url/publicId null
  it('should create a video reel from externalId with null url/publicId', async () => {
    mockCrud.create.mockResolvedValue({ _id: ITEM_ID });

    await createGalleryItem(mockReq({ externalId: YT_ID, type: 'video', title: 'Reel' }), undefined);

    expect(mockCrud.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'video', url: null, publicId: null, externalId: YT_ID, title: 'Reel',
    }));
  });

  // 5. Neither a file nor an externalId → 400
  it('should throw 400 file_or_external_id_is_required when both file and externalId are absent', async () => {
    await expect(createGalleryItem(mockReq({ title: 'x' }), undefined))
      .rejects.toMatchObject({ status: 400, code: 'file_or_external_id_is_required' });
    expect(mockCrud.create).not.toHaveBeenCalled();
  });

  // 6. An empty externalId counts as absent
  it("should treat externalId '' as missing", async () => {
    await expect(createGalleryItem(mockReq({ externalId: '', type: 'video' }), undefined))
      .rejects.toMatchObject({ status: 400, code: 'file_or_external_id_is_required' });
  });

  // 7. A reel outside the video gallery → 400 (body.type 'image' or omitted)
  it('should throw 400 external_id_requires_video_type when a reel is not typed video', async () => {
    await expect(createGalleryItem(mockReq({ externalId: YT_ID, type: 'image' }), undefined))
      .rejects.toMatchObject({ status: 400, code: 'external_id_requires_video_type' });
    await expect(createGalleryItem(mockReq({ externalId: YT_ID }), undefined))
      .rejects.toMatchObject({ status: 400, code: 'external_id_requires_video_type' });
    expect(mockCrud.create).not.toHaveBeenCalled();
  });

  // 8. Current behaviour: a file AND an externalId together are both stored (no exclusivity guard)
  it('should store both url and externalId when a file and an externalId are sent together', async () => {
    mockCrud.create.mockResolvedValue({ _id: ITEM_ID });

    await createGalleryItem(mockReq({ externalId: YT_ID }, { uploadedFile }), 'image');

    expect(mockCrud.create.mock.calls[0][0]).toMatchObject({ type: 'image', url: 'https://cdn/a.png', externalId: YT_ID });
  });

  // 9. A CREATE audit entry is written with the actor, id and the type param
  it('should log a CREATE audit entry with the actor, item id and type', async () => {
    mockCrud.create.mockResolvedValue({ _id: ITEM_ID });
    const req = mockReq({}, { uploadedFile });

    await createGalleryItem(req, 'image');

    expect(mockActorFromReq).toHaveBeenCalledWith(req);
    expect(mockLogAudit).toHaveBeenCalledWith({
      userId: 'admin-id', ip: '127.0.0.1', action: 'CREATE', resource: 'GalleryItem', details: { id: ITEM_ID, type: 'image' },
    });
  });

  // 10. Current behaviour: the audit uses the raw `type` param, so a reel (no file → no mediaType) logs type undefined
  it('should log type undefined in the audit for a reel (uses the param, not the resolved type)', async () => {
    mockCrud.create.mockResolvedValue({ _id: ITEM_ID });

    await createGalleryItem(mockReq({ externalId: YT_ID, type: 'video' }), undefined);

    const { details } = mockLogAudit.mock.calls[0][0];
    expect(details.id).toBe(ITEM_ID);
    // `type` key is present but undefined — toHaveProperty distinguishes this from a missing key
    expect(details).toHaveProperty('type', undefined);
    expect('type' in details).toBe(true);
  });
});

describe('GalleryItems — updateGalleryItem', () => {
  const existingImage = { _id: ITEM_ID, type: 'image', url: 'https://cdn/old.png', publicId: 'gallery/old', isDeleted: false };
  const existingVideo = { _id: ITEM_ID, type: 'video', url: 'https://cdn/old.mp4', publicId: 'gallery/old-vid', isDeleted: false };

  // 1. Only whitelisted metadata fields reach the database
  it('should update only whitelisted fields (no type/url/publicId/isDeleted mass-assignment)', async () => {
    mockCrud.findByPk.mockResolvedValue(existingImage);
    mockCrud.findOneAndUpdate.mockResolvedValue(existingImage);

    await updateGalleryItem(ITEM_ID, mockReq({
      title: 'New', order: 2, isActive: false, description: 'd', alt: 'a', href: '/h', externalId: YT_ID, service: SERVICE_ID,
      type: 'video', url: 'https://evil', publicId: 'hack', isDeleted: true, thumbnailUrl: 'x',
    }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: ITEM_ID }, {
      title: 'New', service: SERVICE_ID, order: 2, isActive: false, description: 'd', alt: 'a', href: '/h', externalId: YT_ID,
    });
    expect(mockReplaceMedia).not.toHaveBeenCalled();
  });

  // 2. service: null is forwarded so the admin can untag the item
  it('should forward service null to unset the linked service', async () => {
    mockCrud.findByPk.mockResolvedValue(existingImage);
    mockCrud.findOneAndUpdate.mockResolvedValue(existingImage);

    await updateGalleryItem(ITEM_ID, mockReq({ service: null }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: ITEM_ID }, { service: null });
  });

  // 3. Missing / deleted item → 404 and no write
  it('should throw 404 and not write when the item is missing or deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...existingImage, isDeleted: true });

    await expect(updateGalleryItem(ITEM_ID, mockReq({ title: 'x' }))).rejects.toMatchObject({ status: 404, code: 'gallery_item_not_found' });
    await expect(updateGalleryItem(ITEM_ID, mockReq({ title: 'x' }))).rejects.toMatchObject({ status: 404, code: 'gallery_item_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 4. Replacing an image: upload to the images folder, delete the old asset, persist the new url/publicId
  it('should replace an image via replaceCloudinaryMedia and persist the new url/publicId', async () => {
    mockCrud.findByPk.mockResolvedValue(existingImage);
    mockReplaceMedia.mockResolvedValue({ url: 'https://cdn/new.png', publicId: 'gallery/new' });
    mockCrud.findOneAndUpdate.mockResolvedValue(existingImage);

    await updateGalleryItem(ITEM_ID, mockReq({ title: 'T' }, { file: imageFile }));

    expect(mockReplaceMedia).toHaveBeenCalledWith({
      file: imageFile, folder: '3mmile/gallery/images', resourceType: 'image', oldPublicId: 'gallery/old',
    });
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: ITEM_ID }, {
      title: 'T', url: 'https://cdn/new.png', publicId: 'gallery/new',
    });
  });

  // 5. Replacing a video: videos folder and resourceType 'video'
  it("should replace a video with folder 3mmile/gallery/videos and resourceType 'video'", async () => {
    mockCrud.findByPk.mockResolvedValue(existingVideo);
    mockReplaceMedia.mockResolvedValue({ url: 'https://cdn/new.mp4', publicId: 'gallery/new-vid' });
    mockCrud.findOneAndUpdate.mockResolvedValue(existingVideo);

    await updateGalleryItem(ITEM_ID, mockReq({}, { file: videoFile }));

    expect(mockReplaceMedia).toHaveBeenCalledWith({
      file: videoFile, folder: '3mmile/gallery/videos', resourceType: 'video', oldPublicId: 'gallery/old-vid',
    });
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: ITEM_ID }, { url: 'https://cdn/new.mp4', publicId: 'gallery/new-vid' });
  });

  // 6. Same-type replacement only: image → video, video → image and unknown mimetypes are rejected before any upload
  it('should throw 400 media_type_mismatch when the uploaded mimetype group differs from the stored type', async () => {
    mockCrud.findByPk
      .mockResolvedValueOnce(existingImage)
      .mockResolvedValueOnce(existingVideo)
      .mockResolvedValueOnce(existingImage);

    await expect(updateGalleryItem(ITEM_ID, mockReq({}, { file: videoFile })))
      .rejects.toMatchObject({ status: 400, code: 'media_type_mismatch' });
    await expect(updateGalleryItem(ITEM_ID, mockReq({}, { file: imageFile })))
      .rejects.toMatchObject({ status: 400, code: 'media_type_mismatch' });
    await expect(updateGalleryItem(ITEM_ID, mockReq({}, { file: { mimetype: 'application/pdf', buffer: Buffer.alloc(0) } })))
      .rejects.toMatchObject({ status: 400, code: 'media_type_mismatch' });
    expect(mockReplaceMedia).not.toHaveBeenCalled();
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 7. Uploading a video file to a reel (video type, no publicId) passes oldPublicId null
  it('should pass oldPublicId null when a reel receives its first uploaded video', async () => {
    mockCrud.findByPk.mockResolvedValue({ ...existingVideo, url: null, publicId: null, externalId: YT_ID });
    mockReplaceMedia.mockResolvedValue({ url: 'https://cdn/v.mp4', publicId: 'gallery/v' });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await updateGalleryItem(ITEM_ID, mockReq({}, { file: videoFile }));

    expect(mockReplaceMedia).toHaveBeenCalledWith(expect.objectContaining({ oldPublicId: null, resourceType: 'video' }));
  });

  // 8. Current behaviour: no video-only guard on externalId during update — an image item can receive one
  it('should accept an externalId on an image item (no type guard on update)', async () => {
    mockCrud.findByPk.mockResolvedValue(existingImage);
    mockCrud.findOneAndUpdate.mockResolvedValue(existingImage);

    await updateGalleryItem(ITEM_ID, mockReq({ externalId: YT_ID }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: ITEM_ID }, { externalId: YT_ID });
  });

  // 9. An UPDATE audit entry records whether the media was replaced
  it('should log an UPDATE audit entry with mediaReplaced false/true', async () => {
    mockCrud.findByPk.mockResolvedValue(existingImage);
    mockCrud.findOneAndUpdate.mockResolvedValue(existingImage);
    mockReplaceMedia.mockResolvedValue({ url: 'u', publicId: 'p' });

    await updateGalleryItem(ITEM_ID, mockReq({ title: 'x' }));
    await updateGalleryItem(ITEM_ID, mockReq({}, { file: imageFile }));

    expect(mockLogAudit.mock.calls[0][0]).toEqual(expect.objectContaining({
      action: 'UPDATE', resource: 'GalleryItem', details: { id: ITEM_ID, mediaReplaced: false },
    }));
    expect(mockLogAudit.mock.calls[1][0]).toEqual(expect.objectContaining({
      action: 'UPDATE', resource: 'GalleryItem', details: { id: ITEM_ID, mediaReplaced: true },
    }));
  });
});

describe('GalleryItems — deleteGalleryItem', () => {
  // 1. Soft delete an image: remove the Cloudinary asset with resourceType 'image', then mark deleted
  it('should delete the image asset and soft-delete the item', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: ITEM_ID, type: 'image', publicId: 'gallery/a', isDeleted: false });
    mockCrud.findOneAndUpdate.mockResolvedValue({ _id: ITEM_ID, isDeleted: true });

    const result = await deleteGalleryItem(ITEM_ID, mockReq());

    expect(mockSafeDelete).toHaveBeenCalledWith('gallery/a', {
      resourceType: 'image', resource: 'GalleryItem', id: ITEM_ID, reason: 'item_deleted',
    });
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: ITEM_ID }, { isDeleted: true, isActive: false });
    expect(result).toEqual({ _id: ITEM_ID, isDeleted: true });
  });

  // 2. Videos must be deleted with resourceType 'video'
  it("should pass resourceType 'video' when deleting a video item", async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: ITEM_ID, type: 'video', publicId: 'gallery/v', isDeleted: false });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await deleteGalleryItem(ITEM_ID, mockReq());

    expect(mockSafeDelete).toHaveBeenCalledWith('gallery/v', {
      resourceType: 'video', resource: 'GalleryItem', id: ITEM_ID, reason: 'item_deleted',
    });
  });

  // 3. A reel has no asset: safeDelete receives null (it no-ops) and the row is still soft-deleted
  it('should call safeDelete with a null publicId for a reel and still soft-delete it', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: ITEM_ID, type: 'video', publicId: null, externalId: YT_ID, isDeleted: false });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await deleteGalleryItem(ITEM_ID, mockReq());

    expect(mockSafeDelete).toHaveBeenCalledWith(null, expect.objectContaining({ resourceType: 'video' }));
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: ITEM_ID }, { isDeleted: true, isActive: false });
  });

  // 4. Missing / already-deleted item → 404 and nothing touched
  it('should throw 404 when the item is missing or already deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: ITEM_ID, isDeleted: true });

    await expect(deleteGalleryItem(ITEM_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'gallery_item_not_found' });
    await expect(deleteGalleryItem(ITEM_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'gallery_item_not_found' });
    expect(mockSafeDelete).not.toHaveBeenCalled();
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 5. A DELETE audit entry is written
  it('should log a DELETE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: ITEM_ID, type: 'image', publicId: 'p', isDeleted: false });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await deleteGalleryItem(ITEM_ID, mockReq());

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', resource: 'GalleryItem', details: { id: ITEM_ID } }));
  });
});
