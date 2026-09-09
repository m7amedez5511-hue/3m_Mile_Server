import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockUploadImage = jest.fn();
const mockLogger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };

jest.unstable_mockModule('../../utils/Cloudinary.config.js', () => ({ uploadImage: mockUploadImage }));
jest.unstable_mockModule('../../utils/winston.js', () => ({ logger: mockLogger, consoleLogger: { ...mockLogger } }));

const { uploadSlotsToCloudinary, slotUploader, SERVICE_SLOTS, HOME_SLOTS, VIDEO_MIME } = await import('../../utils/slotUpload.js');

const file = (name, mimetype = 'image/png', content = 'abc') => ({
  fieldname: name, mimetype, buffer: Buffer.from(content), originalname: `${name}.png`, size: content.length,
});
const cloudResult = (id) => ({ url: `https://cdn/${id}.png`, publicId: id, width: 100, height: 50, extra: 'ignored' });

describe('Utils — uploadSlotsToCloudinary', () => {
  // 1. No files at all → next() with no upload
  it('should call next() without uploading when req.files is undefined', async () => {
    const req = {};
    const next = jest.fn();

    await uploadSlotsToCloudinary('3mmile/services', SERVICE_SLOTS)(req, {}, next);

    expect(mockUploadImage).not.toHaveBeenCalled();
    expect(req.uploadedSlots).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  // 2. multer .fields() gives {} when nothing was sent → next() with no upload
  it('should call next() without uploading when req.files is an empty object', async () => {
    const req = { files: {} };
    const next = jest.fn();

    await uploadSlotsToCloudinary('3mmile/services', SERVICE_SLOTS)(req, {}, next);

    expect(mockUploadImage).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  // 3. Single-count slot yields a plain object; multi-count slot yields an array
  it('should attach req.uploadedSlots with an object for single slots and an array for multi slots', async () => {
    mockUploadImage
      .mockResolvedValueOnce(cloudResult('hero'))
      .mockResolvedValueOnce(cloudResult('c1'))
      .mockResolvedValueOnce(cloudResult('c2'));
    const req = { files: { heroImage: [file('heroImage')], collage: [file('collage'), file('collage')] } };
    const next = jest.fn();

    await uploadSlotsToCloudinary('3mmile/services', SERVICE_SLOTS)(req, {}, next);

    expect(req.uploadedSlots).toEqual({
      heroImage: { url: 'https://cdn/hero.png', publicId: 'hero', width: 100, height: 50 },
      collage: [
        { url: 'https://cdn/c1.png', publicId: 'c1', width: 100, height: 50 },
        { url: 'https://cdn/c2.png', publicId: 'c2', width: 100, height: 50 },
      ],
    });
    expect(next).toHaveBeenCalledWith();
  });

  // 4. A multi-count slot with a single file is still an array
  it('should keep a multi-count slot as an array even with one file', async () => {
    mockUploadImage.mockResolvedValue(cloudResult('c1'));
    const req = { files: { collage: [file('collage')] } };

    await uploadSlotsToCloudinary('3mmile/services', SERVICE_SLOTS)(req, {}, jest.fn());

    expect(Array.isArray(req.uploadedSlots.collage)).toBe(true);
    expect(req.uploadedSlots.collage).toHaveLength(1);
  });

  // 5. Cloudinary is called with a data URI, the folder and auto resource type
  it('should upload each file as a base64 data URI to the given folder with resource_type auto', async () => {
    mockUploadImage.mockResolvedValue(cloudResult('x'));
    const req = { files: { heroImage: [file('heroImage', 'image/jpeg', 'hello')] } };

    await uploadSlotsToCloudinary('3mmile/services', SERVICE_SLOTS)(req, {}, jest.fn());

    expect(mockUploadImage).toHaveBeenCalledTimes(1);
    const [dataUri, folder, options] = mockUploadImage.mock.calls[0];
    expect(dataUri).toBe(`data:image/jpeg;base64,${Buffer.from('hello').toString('base64')}`);
    expect(folder).toBe('3mmile/services');
    expect(options).toEqual({ public_id: expect.stringMatching(/^\d+_[a-z0-9]+$/), resource_type: 'auto' });
  });

  // 6. Only url/publicId/width/height are kept from the Cloudinary result
  it('should strip extra keys from the Cloudinary result', async () => {
    mockUploadImage.mockResolvedValue(cloudResult('x'));
    const req = { files: { heroImage: [file('heroImage')] } };

    await uploadSlotsToCloudinary('f', SERVICE_SLOTS)(req, {}, jest.fn());

    expect(Object.keys(req.uploadedSlots.heroImage).sort()).toEqual(['height', 'publicId', 'url', 'width']);
  });

  // 7. A field not present in the slot spec defaults to single (maxCount 1)
  it('should treat an unknown field as a single slot', async () => {
    mockUploadImage.mockResolvedValue(cloudResult('u'));
    const req = { files: { unknownField: [file('unknownField')] } };

    await uploadSlotsToCloudinary('f', SERVICE_SLOTS)(req, {}, jest.fn());

    expect(req.uploadedSlots.unknownField).toEqual({ url: 'https://cdn/u.png', publicId: 'u', width: 100, height: 50 });
  });

  // 8. Successful uploads are logged with the slot names
  it('should log the uploaded slot names', async () => {
    mockUploadImage.mockResolvedValue(cloudResult('x'));
    const req = { files: { heroImage: [file('heroImage')], wideImage: [file('wideImage')] } };

    await uploadSlotsToCloudinary('3mmile/services', SERVICE_SLOTS)(req, {}, jest.fn());

    expect(mockLogger.info).toHaveBeenCalledWith('Uploaded slots to 3mmile/services: heroImage, wideImage');
  });

  // 9. Cloudinary http_code 400 → SlotUploadError with statusCode 400
  it('should forward a 400 SlotUploadError when Cloudinary answers http_code 400', async () => {
    const cloudErr = Object.assign(new Error('Invalid image file'), { http_code: 400 });
    mockUploadImage.mockRejectedValue(cloudErr);
    const req = { files: { heroImage: [file('heroImage')] } };
    const next = jest.fn();

    await uploadSlotsToCloudinary('f', SERVICE_SLOTS)(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err).toMatchObject({ name: 'SlotUploadError', statusCode: 400, message: 'Upload failed: Invalid image file' });
    expect(req.uploadedSlots).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('Error in uploadSlotsToCloudinary:', cloudErr);
  });

  // 10. Any other failure (outage, auth, no http_code) → 500
  it('should forward a 500 SlotUploadError for other failures', async () => {
    mockUploadImage.mockRejectedValue(Object.assign(new Error('Unauthorized'), { http_code: 401 }));
    const req = { files: { heroImage: [file('heroImage')] } };
    const next = jest.fn();

    await uploadSlotsToCloudinary('f', SERVICE_SLOTS)(req, {}, next);

    expect(next.mock.calls[0][0]).toMatchObject({ name: 'SlotUploadError', statusCode: 500, message: 'Upload failed: Unauthorized' });

    const next2 = jest.fn();
    mockUploadImage.mockRejectedValue(new Error('network down'));
    await uploadSlotsToCloudinary('f', SERVICE_SLOTS)({ files: { heroImage: [file('heroImage')] } }, {}, next2);
    expect(next2.mock.calls[0][0]).toMatchObject({ statusCode: 500, message: 'Upload failed: network down' });
  });

  // 11. Slots are processed in field order and all files in a slot are uploaded
  it('should upload every file of every slot', async () => {
    mockUploadImage.mockImplementation(async (uri) => cloudResult(uri.length.toString()));
    const req = { files: { heroImage: [file('heroImage')], collage: [file('collage'), file('collage'), file('collage')] } };

    await uploadSlotsToCloudinary('f', SERVICE_SLOTS)(req, {}, jest.fn());

    expect(mockUploadImage).toHaveBeenCalledTimes(4);
    expect(Object.keys(req.uploadedSlots)).toEqual(['heroImage', 'collage']);
  });
});

describe('Utils — slotUploader / slot constants', () => {
  // 1. slotUploader returns an Express-style middleware
  it('should return a middleware function', () => {
    const mw = slotUploader(SERVICE_SLOTS);

    expect(typeof mw).toBe('function');
    expect(mw.length).toBe(3);
  });

  // 2. SERVICE_SLOTS mirrors the frontend containers with a 3-image collage
  it('should define the service slots with collage maxCount 3', () => {
    expect(SERVICE_SLOTS).toEqual([
      { name: 'heroImage' }, { name: 'wideImage' }, { name: 'gridImage' }, { name: 'collage', maxCount: 3 },
    ]);
  });

  // 3. HOME_SLOTS: only heroVideo accepts video; trust badges are indexed 0..2
  it('should mark only heroVideo as video-capable in HOME_SLOTS', () => {
    expect(HOME_SLOTS.filter((s) => s.video).map((s) => s.name)).toEqual(['heroVideo']);
    expect(HOME_SLOTS.map((s) => s.name)).toEqual([
      'heroVideo', 'heroPoster', 'whyUsImage', 'branchesTileImage', 'galleryTileImage', 'trustImage0', 'trustImage1', 'trustImage2',
    ]);
  });

  // 4. VIDEO_MIME uses the browser-emitted mime types
  it('should export the browser video mime types', () => {
    expect(VIDEO_MIME).toEqual(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv']);
  });
});
