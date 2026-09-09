import { jest } from '@jest/globals';
import multer from 'multer';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockUploadImage = jest.fn();
const mockLogger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };

jest.unstable_mockModule('../../utils/Cloudinary.config.js', () => ({ uploadImage: mockUploadImage }));
jest.unstable_mockModule('../../utils/winston.js', () => ({ logger: mockLogger, consoleLogger: { ...mockLogger } }));

const {
  handleMulterError, uploadToCloudinary, uploadGalleryMediaToCloudinary, createUploader, uploaders, getPublicIdFromUrl,
} = await import('../../utils/multer.js');

const file = (mimetype = 'image/png', content = 'abc', originalname = 'a.png') => ({
  mimetype, buffer: Buffer.from(content), originalname, size: content.length,
});
const cloudResult = (id) => ({ url: `https://cdn/${id}.png`, publicId: id });

// FileUploadError is module-private; obtain a real instance by making an upload fail.
const captureFileUploadError = async () => {
  mockUploadImage.mockRejectedValueOnce(new Error('boom'));
  const next = jest.fn();
  await uploadToCloudinary('f')({ file: file() }, {}, next);
  return next.mock.calls[0][0];
};

describe('Utils — handleMulterError', () => {
  // 1. LIMIT_FILE_SIZE → file_too_large, 400, field kept on details
  it('should map LIMIT_FILE_SIZE to file_too_large with the field on details', () => {
    const err = new multer.MulterError('LIMIT_FILE_SIZE', 'photo');
    const next = jest.fn();

    handleMulterError(err, {}, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    const mapped = next.mock.calls[0][0];
    expect(mapped).not.toBe(err);
    expect(mapped).toMatchObject({
      name: 'FileUploadError', code: 'file_too_large', statusCode: 400, message: 'file_too_large',
      details: [{ field: 'photo', code: err.message }],
    });
  });

  // 2. Every known multer code maps to its snake_case equivalent
  it('should map every known multer code', () => {
    const expected = {
      LIMIT_FILE_COUNT: 'too_many_files',
      LIMIT_UNEXPECTED_FILE: 'unexpected_file_field',
      LIMIT_PART_COUNT: 'too_many_files',
      LIMIT_FIELD_COUNT: 'too_many_files',
    };
    for (const [multerCode, apiCode] of Object.entries(expected)) {
      const next = jest.fn();
      handleMulterError(new multer.MulterError(multerCode, 'f'), {}, {}, next);
      expect(next.mock.calls[0][0]).toMatchObject({ code: apiCode, statusCode: 400 });
    }
  });

  // 3. Unknown multer codes fall back to upload_failed
  it('should map an unknown multer code to upload_failed', () => {
    const next = jest.fn();

    handleMulterError(new multer.MulterError('LIMIT_FIELD_KEY'), {}, {}, next);

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'upload_failed', statusCode: 400 });
  });

  // 4. Missing field name on the multer error defaults details.field to 'file'
  it("should default details.field to 'file' when the multer error has no field", () => {
    const next = jest.fn();

    handleMulterError(new multer.MulterError('LIMIT_FILE_SIZE'), {}, {}, next);

    expect(next.mock.calls[0][0].details).toEqual([{ field: 'file', code: 'File too large' }]);
  });

  // 5. A FileUploadError (mime rejection / upload failure) → file_type_not_allowed keeping its statusCode
  it('should map a FileUploadError to file_type_not_allowed and keep its statusCode', async () => {
    const original = await captureFileUploadError();
    expect(original).toMatchObject({ name: 'FileUploadError', statusCode: 500 });
    const next = jest.fn();

    handleMulterError(original, {}, {}, next);

    expect(next.mock.calls[0][0]).toMatchObject({
      code: 'file_type_not_allowed', statusCode: 500, details: [{ field: 'file', code: 'Upload failed: boom' }],
    });
  });

  // 6. A SlotUploadError is recognised by name and mapped the same way
  it('should map an error named SlotUploadError to file_type_not_allowed', () => {
    const err = Object.assign(new Error("File type not allowed for 'heroImage'"), { name: 'SlotUploadError', statusCode: 400 });
    const next = jest.fn();

    handleMulterError(err, {}, {}, next);

    expect(next.mock.calls[0][0]).toMatchObject({
      code: 'file_type_not_allowed', statusCode: 400, details: [{ field: 'file', code: "File type not allowed for 'heroImage'" }],
    });
  });

  // 7. SlotUploadError without statusCode defaults to 400
  it('should default a SlotUploadError without statusCode to 400', () => {
    const err = Object.assign(new Error('x'), { name: 'SlotUploadError' });
    const next = jest.fn();

    handleMulterError(err, {}, {}, next);

    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  // 8. Any other error passes through untouched
  it('should pass unrelated errors through unchanged', () => {
    const err = new Error('something else');
    const next = jest.fn();

    handleMulterError(err, {}, {}, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(next.mock.calls[0][0]).toBe(err);
  });
});

describe('Utils — uploadToCloudinary', () => {
  // 1. No file(s) → next() with no upload
  it('should call next() without uploading when neither req.file nor req.files is set', async () => {
    const req = {};
    const next = jest.fn();

    await uploadToCloudinary('3mmile/products')(req, {}, next);

    expect(mockUploadImage).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
    expect(req.uploadedFile).toBeUndefined();
    expect(req.uploadedFiles).toBeUndefined();
  });

  // 2. Single file → req.uploadedFile with the folder and auto resource type
  it('should upload req.file and attach req.uploadedFile', async () => {
    const result = cloudResult('one');
    mockUploadImage.mockResolvedValue(result);
    const req = { file: file('image/jpeg', 'hello') };
    const next = jest.fn();

    await uploadToCloudinary('3mmile/products')(req, {}, next);

    expect(mockUploadImage).toHaveBeenCalledTimes(1);
    expect(mockUploadImage).toHaveBeenCalledWith(
      `data:image/jpeg;base64,${Buffer.from('hello').toString('base64')}`,
      '3mmile/products',
      { public_id: expect.stringMatching(/^\d+_[a-z0-9]*$/), resource_type: 'auto' },
    );
    expect(req.uploadedFile).toBe(result);
    expect(req.uploadedFiles).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  // 3. Multiple files → req.uploadedFiles in order
  it('should upload every req.files entry and attach req.uploadedFiles', async () => {
    mockUploadImage.mockResolvedValueOnce(cloudResult('a')).mockResolvedValueOnce(cloudResult('b'));
    const req = { files: [file('image/png', 'x'), file('image/png', 'y')] };
    const next = jest.fn();

    await uploadToCloudinary('3mmile/gallery')(req, {}, next);

    expect(mockUploadImage).toHaveBeenCalledTimes(2);
    expect(req.uploadedFiles).toEqual([cloudResult('a'), cloudResult('b')]);
    expect(req.uploadedFile).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  // 4. Default folder is 'theshop'
  it("should default the folder to 'theshop'", async () => {
    mockUploadImage.mockResolvedValue(cloudResult('d'));

    await uploadToCloudinary()({ file: file() }, {}, jest.fn());

    expect(mockUploadImage.mock.calls[0][1]).toBe('theshop');
  });

  // 5. Upload failure → FileUploadError 500 with the message, logged
  it('should forward a 500 FileUploadError when Cloudinary fails', async () => {
    const cloudErr = new Error('quota exceeded');
    mockUploadImage.mockRejectedValue(cloudErr);
    const req = { file: file() };
    const next = jest.fn();

    await uploadToCloudinary('f')(req, {}, next);

    expect(next.mock.calls[0][0]).toMatchObject({ name: 'FileUploadError', statusCode: 500, message: 'Upload failed: quota exceeded' });
    expect(req.uploadedFile).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('Error in uploadToCloudinary:', cloudErr);
  });

  // 6. Progress is logged
  it('should log the upload count and folder', async () => {
    mockUploadImage.mockResolvedValue(cloudResult('l'));

    await uploadToCloudinary('logs')({ files: [file(), file()] }, {}, jest.fn());

    expect(mockLogger.info).toHaveBeenCalledWith('Uploading 2 file(s) to Cloudinary folder: logs');
    expect(mockLogger.info).toHaveBeenCalledWith('Successfully uploaded 2 file(s) to Cloudinary');
  });
});

describe('Utils — uploadGalleryMediaToCloudinary', () => {
  // 1. No file → next() (YouTube reels have no asset)
  it('should call next() without uploading when there is no file', async () => {
    const req = {};
    const next = jest.fn();

    await uploadGalleryMediaToCloudinary(req, {}, next);

    expect(mockUploadImage).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
    expect(req.mediaType).toBeUndefined();
  });

  // 2. Image mimetype → image folder, resource_type image, mediaType 'image'
  it('should upload images to the gallery images folder and set mediaType image', async () => {
    const result = cloudResult('img');
    mockUploadImage.mockResolvedValue(result);
    const req = { file: file('image/webp', 'pic') };
    const next = jest.fn();

    await uploadGalleryMediaToCloudinary(req, {}, next);

    expect(mockUploadImage).toHaveBeenCalledWith(
      `data:image/webp;base64,${Buffer.from('pic').toString('base64')}`,
      '3mmile/gallery/images',
      expect.objectContaining({ resource_type: 'image' }),
    );
    expect(req.mediaType).toBe('image');
    expect(req.uploadedFile).toBe(result);
    expect(next).toHaveBeenCalledWith();
  });

  // 3. Video mimetype → videos folder, resource_type video
  it('should upload videos to the gallery videos folder and set mediaType video', async () => {
    mockUploadImage.mockResolvedValue(cloudResult('vid'));
    const req = { file: file('video/quicktime', 'mov') };

    await uploadGalleryMediaToCloudinary(req, {}, jest.fn());

    expect(mockUploadImage.mock.calls[0][1]).toBe('3mmile/gallery/videos');
    expect(mockUploadImage.mock.calls[0][2]).toMatchObject({ resource_type: 'video' });
    expect(req.mediaType).toBe('video');
  });

  // 4. Unsupported mimetype (safety net) → 400 FileUploadError, no upload
  it('should reject an unsupported mimetype with a 400 FileUploadError', async () => {
    const next = jest.fn();

    await uploadGalleryMediaToCloudinary({ file: file('application/pdf') }, {}, next);

    expect(mockUploadImage).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toMatchObject({ name: 'FileUploadError', statusCode: 400, message: 'Unsupported file type for gallery item' });
  });

  // 5. Upload failure → 500
  it('should forward a 500 FileUploadError when the upload fails', async () => {
    mockUploadImage.mockRejectedValue(new Error('down'));
    const next = jest.fn();

    await uploadGalleryMediaToCloudinary({ file: file() }, {}, next);

    expect(next.mock.calls[0][0]).toMatchObject({ name: 'FileUploadError', statusCode: 500, message: 'Upload failed: down' });
  });
});

describe('Utils — createUploader / uploaders / getPublicIdFromUrl', () => {
  // 1. createUploader returns a multer instance exposing single/array/fields
  it('should return a multer instance', () => {
    const up = createUploader();

    expect(typeof up.single).toBe('function');
    expect(typeof up.array).toBe('function');
    expect(typeof up.fields).toBe('function');
  });

  // 2. All pre-configured uploaders exist
  it('should expose the pre-configured uploaders', () => {
    expect(Object.keys(uploaders).sort()).toEqual([
      'bannerImage', 'categoryImage', 'document', 'galleryMedia', 'productImage', 'productImages', 'profileImage', 'video',
    ]);
    for (const up of Object.values(uploaders)) expect(typeof up.single).toBe('function');
  });

  // 3. getPublicIdFromUrl strips the path and extension
  it('should extract the public id from a Cloudinary URL', () => {
    expect(getPublicIdFromUrl('https://res.cloudinary.com/demo/image/upload/v1/folder/abc123.png')).toBe('abc123');
    expect(getPublicIdFromUrl('abc.tar.gz')).toBe('abc');
  });

  // 4. Non-string input → FileUploadError 500
  it('should throw a 500 FileUploadError for a non-string URL', () => {
    expect(() => getPublicIdFromUrl(undefined)).toThrow(expect.objectContaining({ statusCode: 500, message: 'Failed to extract public ID' }));
  });
});
