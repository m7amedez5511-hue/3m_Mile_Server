import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockDeleteImage = jest.fn();
const mockLogger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };

jest.unstable_mockModule('../../utils/Cloudinary.config.js', () => ({ deleteImage: mockDeleteImage }));
jest.unstable_mockModule('../../utils/winston.js', () => ({ logger: mockLogger, consoleLogger: { ...mockLogger } }));

const { safeDeleteCloudinaryImage } = await import('../../utils/softDeleteImage.js');

describe('Utils — safeDeleteCloudinaryImage', () => {
  // 1. No publicId → nothing is called, resolves to undefined
  it('should do nothing when publicId is falsy', async () => {
    await expect(safeDeleteCloudinaryImage(undefined)).resolves.toBeUndefined();
    await expect(safeDeleteCloudinaryImage(null, { resource: 'Review' })).resolves.toBeUndefined();
    await expect(safeDeleteCloudinaryImage('')).resolves.toBeUndefined();

    expect(mockDeleteImage).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  // 2. Default resource type is 'image'
  it("should delete with resourceType 'image' by default", async () => {
    mockDeleteImage.mockResolvedValue({ result: 'ok' });

    await safeDeleteCloudinaryImage('products/abc');

    expect(mockDeleteImage).toHaveBeenCalledTimes(1);
    expect(mockDeleteImage).toHaveBeenCalledWith('products/abc', { resourceType: 'image' });
  });

  // 3. Caller-supplied resourceType is forwarded (videos need it explicitly)
  it('should forward an explicit resourceType', async () => {
    mockDeleteImage.mockResolvedValue({ result: 'ok' });

    await safeDeleteCloudinaryImage('gallery/vid', { resourceType: 'video', resource: 'Gallery' });

    expect(mockDeleteImage).toHaveBeenCalledWith('gallery/vid', { resourceType: 'video' });
  });

  // 4. Only resourceType goes to Cloudinary — other context keys are log-only
  it('should not pass log context keys to Cloudinary', async () => {
    mockDeleteImage.mockResolvedValue({ result: 'ok' });

    await safeDeleteCloudinaryImage('p', { resource: 'Product', id: '1', reason: 'product_deleted' });

    expect(mockDeleteImage.mock.calls[0][1]).toEqual({ resourceType: 'image' });
  });

  // 5. Success path logs nothing and resolves undefined
  it('should resolve undefined and not log on success', async () => {
    mockDeleteImage.mockResolvedValue({ result: 'ok' });

    await expect(safeDeleteCloudinaryImage('p')).resolves.toBeUndefined();

    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  // 6. Failures are swallowed and logged with publicId, resourceType, message and context
  it('should swallow a Cloudinary failure and log it with the context', async () => {
    mockDeleteImage.mockRejectedValue(new Error('not found'));

    await expect(
      safeDeleteCloudinaryImage('products/abc', { resource: 'Product', id: 'p1', reason: 'replaced_on_update' }),
    ).resolves.toBeUndefined();

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to delete Cloudinary image', {
      publicId: 'products/abc',
      resourceType: 'image',
      error: 'not found',
      resource: 'Product',
      id: 'p1',
      reason: 'replaced_on_update',
    });
  });

  // 7. The explicit resourceType appears once in the log payload (pulled out of context)
  it('should log the explicit resourceType without duplicating it from the context', async () => {
    mockDeleteImage.mockRejectedValue(new Error('boom'));

    await safeDeleteCloudinaryImage('v', { resourceType: 'video', resource: 'Gallery' });

    expect(mockLogger.error.mock.calls[0][1]).toEqual({
      publicId: 'v', resourceType: 'video', error: 'boom', resource: 'Gallery',
    });
  });

  // 8. Never rethrows, even for a non-Error rejection
  it('should never reject, even when the rejection is not an Error', async () => {
    mockDeleteImage.mockRejectedValue('string failure');

    await expect(safeDeleteCloudinaryImage('p')).resolves.toBeUndefined();

    expect(mockLogger.error.mock.calls[0][1]).toMatchObject({ publicId: 'p', error: undefined });
  });
});
