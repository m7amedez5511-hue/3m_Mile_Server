import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockLogger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
jest.unstable_mockModule('../../utils/winston.js', () => ({
  logger: mockLogger,
  consoleLogger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const { errorHandler, notFoundHandler, asyncHandler } = await import('../../middleware/errorHandler.js');
const { createAppError } = await import('../../utils/createAppError.js');

// NODE_ENV=test → isDevelopmentEnv() is false, so non-operational/5xx messages are masked
const mockReq = (extra = {}) => ({ method: 'GET', originalUrl: '/api/v1/test', ip: '127.0.0.1', ...extra });
const mockRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const body = (res) => res.json.mock.calls[0][0];

describe('Error handler — errorHandler', () => {
  // 1. AppError: explicit status, code, message passthrough (operational), warn-level log
  it('should map an AppError to its status/code and pass its message through', () => {
    const res = mockRes();
    const next = jest.fn();

    errorHandler(createAppError(404, 'product_not_found'), mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(body(res)).toEqual({
      success: false,
      message: 'product_not_found',
      responseAt: expect.any(Date),
      error: { code: 'product_not_found', path: '/api/v1/test', details: null },
    });
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  // 2. ZodError → 400 validation_failed with per-field details and first-issue message
  it('should map a ZodError to 400 validation_failed with issue details', () => {
    const res = mockRes();
    const error = { name: 'ZodError', message: 'raw', issues: [{ path: ['email'], message: 'Invalid email' }, { path: ['a', 'b'], message: 'Required' }] };

    errorHandler(error, mockReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res)).toMatchObject({
      message: 'Validation failed: email (Invalid email).',
      error: {
        code: 'validation_failed',
        details: [{ field: 'email', code: 'Invalid email' }, { field: 'a.b', code: 'Required' }],
      },
    });
    expect(mockLogger.warn.mock.calls[0][0].validationErrors).toEqual([
      { field: 'email', code: 'Invalid email' }, { field: 'a.b', code: 'Required' },
    ]);
  });

  // 3. Mongoose ValidationError → 400 validation_failed, masked message, field details
  it('should map a Mongoose ValidationError to 400 validation_failed with field details', () => {
    const res = mockRes();
    const error = { name: 'ValidationError', message: 'User validation failed', errors: { email: { message: 'Path `email` is required.' } } };

    errorHandler(error, mockReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res)).toMatchObject({
      message: 'Bad request',
      error: { code: 'validation_failed', details: [{ field: 'email', code: 'Path `email` is required.' }] },
    });
  });

  // 4. CastError → 400 with a non-disclosing message
  it('should map a CastError to 400 with a generic identifier message', () => {
    const res = mockRes();
    const error = { name: 'CastError', message: 'Cast to ObjectId failed for value "abc" at path "_id" for model "Product"' };

    errorHandler(error, mockReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res)).toMatchObject({
      message: 'Invalid resource identifier.',
      error: { code: 'Invalid resource identifier', details: null },
    });
  });

  // 5. Duplicate key 11000 → 409 with a field-derived code
  it('should map a duplicate key error to 409 <field>_already_exists', () => {
    const res = mockRes();
    const error = { name: 'MongoServerError', code: 11000, keyPattern: { email: 1 }, message: 'E11000 duplicate key' };

    errorHandler(error, mockReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(body(res)).toMatchObject({ message: 'A duplicate entry was found.', error: { code: 'email_already_exists' } });
  });

  // 6. Duplicate key without keyPattern → duplicate_entry
  it('should fall back to duplicate_entry when keyPattern is missing', () => {
    const res = mockRes();

    errorHandler({ code: 11000, message: 'E11000' }, mockReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(body(res).error.code).toBe('duplicate_entry');
  });

  // 7. JsonWebTokenError → 401 invalid_token
  it('should map a JsonWebTokenError to 401 invalid_token', () => {
    const res = mockRes();

    errorHandler({ name: 'JsonWebTokenError', message: 'invalid signature' }, mockReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(body(res)).toMatchObject({
      message: 'Invalid authentication token. Please log in again.',
      error: { code: 'invalid_token' },
    });
  });

  // 8. TokenExpiredError → 401 token_expired
  it('should map a TokenExpiredError to 401 token_expired', () => {
    const res = mockRes();

    errorHandler({ name: 'TokenExpiredError', message: 'jwt expired' }, mockReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(body(res)).toMatchObject({
      message: 'Authentication token expired. Please log in again.',
      error: { code: 'token_expired' },
    });
  });

  // 9. Unknown error → 500 internal_error, masked message, no stack in the body, error-level log with stack
  it('should map an unknown error to 500 internal_error and hide internals outside development', () => {
    const res = mockRes();
    const error = new Error('ECONNREFUSED 10.0.0.5:27017');

    errorHandler(error, mockReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(body(res)).toEqual({
      success: false,
      message: 'An internal server error occurred.',
      responseAt: expect.any(Date),
      error: { code: 'internal_error', path: '/api/v1/test', details: null },
    });
    expect(body(res).error.stack).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error.mock.calls[0][0]).toMatchObject({ status: 500, message: 'ECONNREFUSED 10.0.0.5:27017', stack: expect.any(String) });
  });

  // 10. Non-operational 4xx (e.g. third-party) message is masked to the default for that status
  it('should mask the message of a non-operational 4xx error', () => {
    const res = mockRes();
    const error = Object.assign(new Error('Cloudinary: invalid api key'), { status: 400 });

    errorHandler(error, mockReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res).message).toBe('Bad request');
    expect(body(res).error.code).toBe('internal_error');
  });

  // 11. statusCode is honoured when status is absent; string code is echoed
  it('should honour statusCode and echo a string error.code', () => {
    const res = mockRes();
    const error = Object.assign(new Error('nope'), { statusCode: 422, code: 'unprocessable_thing', isOperational: true });

    errorHandler(error, mockReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(422);
    expect(body(res)).toMatchObject({ message: 'nope', error: { code: 'unprocessable_thing' } });
  });

  // 12. Named errors from ERROR_TYPES resolve their status without an explicit status field
  it('should resolve status from ERROR_TYPES by error name', () => {
    const res = mockRes();

    errorHandler({ name: 'ForbiddenError', message: 'no' }, mockReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(body(res).message).toBe('Forbidden');
  });

  // 13. Custom error.details (non-validation) are surfaced
  it('should surface error.details when present on a non-validation error', () => {
    const res = mockRes();
    const error = Object.assign(createAppError(400, 'bad_input'), { details: { hint: 'x' } });

    errorHandler(error, mockReq(), res, jest.fn());

    expect(body(res).error.details).toEqual({ hint: 'x' });
  });

  // 14. Log entry carries request context and the acting user (_id from a lean doc)
  it('should log method, path, status and the user id', () => {
    const res = mockRes();

    errorHandler(createAppError(403, 'user_not_authorized'), mockReq({ method: 'DELETE', user: { _id: 'u1' } }), res, jest.fn());

    expect(mockLogger.warn.mock.calls[0][0]).toMatchObject({
      method: 'DELETE', path: '/api/v1/test', status: 403, code: 'user_not_authorized', user: 'u1', ip: '127.0.0.1',
    });
  });

  // 15. Unauthenticated requests are logged as "anonymous"
  it('should log "anonymous" when there is no req.user', () => {
    const res = mockRes();

    errorHandler(createAppError(401, 'Unauthorized'), mockReq(), res, jest.fn());

    expect(mockLogger.warn.mock.calls[0][0].user).toBe('anonymous');
  });
});

describe('Error handler — notFoundHandler', () => {
  // 1. Builds a 404 NotFoundError naming the route and forwards it
  it('should forward a 404 NotFoundError describing the route', () => {
    const next = jest.fn();

    notFoundHandler(mockReq({ method: 'POST', originalUrl: '/nope' }), mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err).toMatchObject({ status: 404, name: 'NotFoundError', message: 'Route not found: POST /nope' });
  });

  // 2. Fed through errorHandler: 404 status but generic code/message (no `code` set on the error)
  it('should render as 404 with code internal_error and the default message via errorHandler', () => {
    const next = jest.fn();
    const res = mockRes();
    notFoundHandler(mockReq({ originalUrl: '/nope' }), mockRes(), next);

    errorHandler(next.mock.calls[0][0], mockReq({ originalUrl: '/nope' }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(body(res)).toMatchObject({ message: 'Resource not found', error: { code: 'internal_error', path: '/nope' } });
  });
});

describe('Error handler — asyncHandler', () => {
  // 1. Resolved handlers do not call next
  it('should invoke the wrapped function with (req, res, next) and not call next on success', async () => {
    const fn = jest.fn(async (req, res) => res.json({ ok: true }));
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    asyncHandler(fn)(req, res, next);
    await new Promise((r) => setImmediate(r));

    expect(fn).toHaveBeenCalledWith(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  // 2. Rejections are forwarded to next(err)
  it('should forward a rejected promise to next', async () => {
    const error = createAppError(400, 'boom');
    const next = jest.fn();

    asyncHandler(async () => { throw error; })(mockReq(), mockRes(), next);
    await new Promise((r) => setImmediate(r));

    expect(next).toHaveBeenCalledWith(error);
  });

  // 3. Non-promise return values are tolerated
  it('should tolerate a synchronous non-promise return value', async () => {
    const next = jest.fn();

    expect(() => asyncHandler(() => 'sync')(mockReq(), mockRes(), next)).not.toThrow();
    await new Promise((r) => setImmediate(r));

    expect(next).not.toHaveBeenCalled();
  });

  // 4. A synchronous throw from a NON-async function is NOT caught (current behaviour)
  it('should let a synchronous throw from a non-async function escape (not forwarded to next)', () => {
    const next = jest.fn();

    expect(() => asyncHandler(() => { throw new Error('sync boom'); })(mockReq(), mockRes(), next)).toThrow('sync boom');
    expect(next).not.toHaveBeenCalled();
  });
});
