import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockCrud = {
  findOneAndUpdate: jest.fn(),
};
const mockSafeDelete = jest.fn().mockResolvedValue(undefined);
const mockLogAudit = jest.fn();
const mockActorFromReq = jest.fn(() => ({ userId: 'admin-id', ip: '127.0.0.1' }));
const mockGetOrCreate = jest.fn();
const MockModel = { modelName: 'Thing' };
const mockMongooseModel = jest.fn(() => MockModel);

jest.unstable_mockModule('mongoose', () => ({ default: { model: mockMongooseModel } }));
jest.unstable_mockModule('../../services/crud.service.js', () => ({ default: () => mockCrud }));
jest.unstable_mockModule('../../utils/softDeleteImage.js', () => ({ safeDeleteCloudinaryImage: mockSafeDelete }));
jest.unstable_mockModule('../../utils/auditLogger.js', () => ({ logAudit: mockLogAudit, actorFromReq: mockActorFromReq }));
jest.unstable_mockModule('../../utils/singletonUpsert.js', () => ({ getOrCreateSingleton: mockGetOrCreate }));

const { singletonService } = await import('../../services/singleton.service.js');

const DOC_ID = '64a1f0c2e4b0a1b2c3d4e5f6';
const mockReq = (body = {}, extra = {}) => ({ body, ip: '127.0.0.1', user: { _id: 'admin-id' }, ...extra });

const CONFIG = {
  updatableFields: ['title', 'nested.label', 'count'],
  imageSlots: {
    pic: { urlField: 'pic.url', publicIdField: 'pic.publicId' },
    vid: {
      urlField: 'vid.url', publicIdField: 'vid.publicId', resourceType: 'video',
      widthField: 'vid.width', heightField: 'vid.height',
    },
  },
};

describe('singletonService — get', () => {
  // 1. get resolves the model by name and delegates to getOrCreateSingleton
  it('should look up the mongoose model by name and delegate to getOrCreateSingleton', async () => {
    const doc = { _id: DOC_ID, title: 'x' };
    mockGetOrCreate.mockResolvedValue(doc);
    const { get } = singletonService('Thing', CONFIG);

    const result = await get();

    expect(mockMongooseModel).toHaveBeenCalledWith('Thing');
    expect(mockGetOrCreate).toHaveBeenCalledWith(MockModel);
    expect(result).toBe(doc);
  });

  // 2. The model is resolved lazily on each read, not at factory time
  it('should not resolve the model until get is called', () => {
    singletonService('Lazy', CONFIG);

    expect(mockMongooseModel).not.toHaveBeenCalled();
  });
});

describe('singletonService — update', () => {
  const existing = { _id: DOC_ID, title: 'Orig', pic: { url: null, publicId: null }, vid: { url: null, publicId: null } };

  // 1. Only whitelisted fields are written; unknown keys are dropped
  it('should write only whitelisted fields and drop mass-assignment keys', async () => {
    mockGetOrCreate.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue({ ...existing, title: 'New' });
    const { update } = singletonService('Thing', CONFIG);

    const result = await update(mockReq({
      title: 'New', 'nested.label': 'L', _id: 'hack', singletonKey: 'other', 'pic.publicId': 'stolen', extra: 1,
    }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: DOC_ID }, { title: 'New', 'nested.label': 'L' });
    expect(result).toEqual({ ...existing, title: 'New' });
  });

  // 2. undefined is skipped but null and '' are legitimate clearing values
  it("should skip undefined values but keep null and '' so fields can be cleared", async () => {
    mockGetOrCreate.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const { update } = singletonService('Thing', CONFIG);

    await update(mockReq({ title: undefined, 'nested.label': '', count: null }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: DOC_ID }, { 'nested.label': '', count: null });
  });

  // 3. An empty body still persists an empty update and returns the document
  it('should persist an empty update when nothing editable was sent', async () => {
    mockGetOrCreate.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const { update } = singletonService('Thing', CONFIG);

    await update(mockReq({}));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: DOC_ID }, {});
  });

  // 4. A single uploaded file is mapped to its url/publicId paths
  it('should map a single uploaded slot onto its url and publicId paths', async () => {
    mockGetOrCreate.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const { update } = singletonService('Thing', CONFIG);

    await update(mockReq({}, { uploadedSlots: { pic: { url: 'https://cdn/p.png', publicId: 'p' } } }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: DOC_ID }, { 'pic.url': 'https://cdn/p.png', 'pic.publicId': 'p' });
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 5. An array upload uses the first file only
  it('should use the first file when the slot holds an array', async () => {
    mockGetOrCreate.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const { update } = singletonService('Thing', CONFIG);

    await update(mockReq({}, { uploadedSlots: { pic: [{ url: 'https://cdn/1.png', publicId: 'one' }, { url: 'https://cdn/2.png', publicId: 'two' }] } }));

    expect(mockCrud.findOneAndUpdate.mock.calls[0][1]).toEqual({ 'pic.url': 'https://cdn/1.png', 'pic.publicId': 'one' });
  });

  // 6. Width/height are written only for numeric values and only on slots that declare them
  it('should write width/height only when numeric and the slot declares dimension fields', async () => {
    mockGetOrCreate.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const { update } = singletonService('Thing', CONFIG);

    await update(mockReq({}, { uploadedSlots: { vid: { url: 'https://cdn/v.mp4', publicId: 'v', width: 1920, height: 1080 } } }));
    await update(mockReq({}, { uploadedSlots: { vid: { url: 'https://cdn/v.mp4', publicId: 'v', width: '1920', height: undefined } } }));
    await update(mockReq({}, { uploadedSlots: { pic: { url: 'https://cdn/p.png', publicId: 'p', width: 10, height: 10 } } }));

    expect(mockCrud.findOneAndUpdate.mock.calls[0][1]).toEqual({
      'vid.url': 'https://cdn/v.mp4', 'vid.publicId': 'v', 'vid.width': 1920, 'vid.height': 1080,
    });
    expect(mockCrud.findOneAndUpdate.mock.calls[1][1]).toEqual({ 'vid.url': 'https://cdn/v.mp4', 'vid.publicId': 'v' });
    expect(mockCrud.findOneAndUpdate.mock.calls[2][1]).toEqual({ 'pic.url': 'https://cdn/p.png', 'pic.publicId': 'p' });
  });

  // 7. Replaced image asset is deleted from Cloudinary with resourceType 'image'
  it('should delete the previous image asset with resourceType image', async () => {
    mockGetOrCreate.mockResolvedValue({ ...existing, pic: { url: 'https://cdn/old.png', publicId: 'old-pic' } });
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const { update } = singletonService('Thing', CONFIG);

    await update(mockReq({}, { uploadedSlots: { pic: { url: 'https://cdn/new.png', publicId: 'new-pic' } } }));

    expect(mockSafeDelete).toHaveBeenCalledTimes(1);
    expect(mockSafeDelete).toHaveBeenCalledWith('old-pic', {
      resource: 'Thing', id: DOC_ID, resourceType: 'image', reason: 'pic_replaced_on_update',
    });
  });

  // 8. Replaced video asset is deleted with the slot's explicit resourceType
  it('should delete the previous video asset with resourceType video', async () => {
    mockGetOrCreate.mockResolvedValue({ ...existing, vid: { url: 'https://cdn/old.mp4', publicId: 'old-vid' } });
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const { update } = singletonService('Thing', CONFIG);

    await update(mockReq({}, { uploadedSlots: { vid: { url: 'https://cdn/new.mp4', publicId: 'new-vid' } } }));

    expect(mockSafeDelete).toHaveBeenCalledWith('old-vid', {
      resource: 'Thing', id: DOC_ID, resourceType: 'video', reason: 'vid_replaced_on_update',
    });
  });

  // 9. Slots that were not uploaded leave their paths and stored assets untouched
  it('should not touch or delete slots that were not uploaded', async () => {
    mockGetOrCreate.mockResolvedValue({ ...existing, pic: { url: 'https://cdn/old.png', publicId: 'old-pic' } });
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const { update } = singletonService('Thing', CONFIG);

    await update(mockReq({ title: 'Text only' }));
    await update(mockReq({ title: 'Text only' }, { uploadedSlots: { unknownSlot: { url: 'x', publicId: 'y' } } }));

    expect(mockCrud.findOneAndUpdate.mock.calls[0][1]).toEqual({ title: 'Text only' });
    expect(mockCrud.findOneAndUpdate.mock.calls[1][1]).toEqual({ title: 'Text only' });
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 10. imageSlots defaults to {} so uploads are ignored for text-only singletons
  it('should ignore uploadedSlots entirely when the service declares no imageSlots', async () => {
    mockGetOrCreate.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const { update } = singletonService('TextOnly', { updatableFields: ['title'] });

    await update(mockReq({ title: 'T' }, { uploadedSlots: { pic: { url: 'x', publicId: 'y' } } }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: DOC_ID }, { title: 'T' });
  });

  // 11. An UPDATE audit entry is written for the acting admin
  it('should log an UPDATE audit entry with the actor and document id', async () => {
    mockGetOrCreate.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const { update } = singletonService('Thing', CONFIG);
    const req = mockReq({ title: 'T' });

    await update(req);

    expect(mockActorFromReq).toHaveBeenCalledWith(req);
    expect(mockLogAudit).toHaveBeenCalledWith({
      userId: 'admin-id', ip: '127.0.0.1', action: 'UPDATE', resource: 'Thing', details: { id: DOC_ID },
    });
  });

  // 12. A failure to fetch the singleton aborts the write
  it('should propagate a getOrCreateSingleton failure and not write', async () => {
    mockGetOrCreate.mockRejectedValue(new Error('refusing to guess'));
    const { update } = singletonService('Thing', CONFIG);

    await expect(update(mockReq({ title: 'T' }))).rejects.toThrow('refusing to guess');
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});
