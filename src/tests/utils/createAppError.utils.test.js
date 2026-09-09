// Pure util — no mocks required.
const { AppError, createAppError } = await import('../../utils/createAppError.js');

describe('Utils — AppError', () => {
  // 1. Constructor sets status, code, message and the operational flag
  it('should set status, code, message and isOperational', () => {
    const err = new AppError(404, 'product_not_found');

    expect(err.status).toBe(404);
    expect(err.code).toBe('product_not_found');
    expect(err.message).toBe('product_not_found');
    expect(err.isOperational).toBe(true);
  });

  // 2. It is a real Error with a stack trace
  it('should be an instance of Error with a stack', () => {
    const err = new AppError(400, 'bad');

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(typeof err.stack).toBe('string');
    expect(err.name).toBe('Error');
  });
});

describe('Utils — createAppError', () => {
  // 1. Factory returns an AppError with the given status/code
  it('should return an AppError carrying the given status and code', () => {
    const err = createAppError(401, 'unauthorized');

    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ status: 401, code: 'unauthorized', message: 'unauthorized', isOperational: true });
  });

  // 2. Each call yields a distinct instance
  it('should create a new instance on every call', () => {
    const a = createAppError(400, 'x');
    const b = createAppError(400, 'x');

    expect(a).not.toBe(b);
  });

  // 3. Works with throw / rejects the way services use it
  it('should be usable as a thrown value in async code', async () => {
    const fn = async () => { throw createAppError(403, 'forbidden'); };

    await expect(fn()).rejects.toMatchObject({ status: 403, code: 'forbidden' });
  });
});
