import { jest } from '@jest/globals';
import { z } from 'zod';

// ---- Mocks (registered BEFORE the module under test is imported) ----
jest.unstable_mockModule('../../utils/winston.js', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
  consoleLogger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const { validate } = await import('../../middleware/validate.js');

const mockRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

// asyncHandler does not return the promise, so resolve once next() fires
const run = (middleware, req) => new Promise((resolve) => {
  const next = jest.fn((err) => resolve({ err, next }));
  middleware(req, mockRes(), next);
});

const schema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  name: z.string().trim(),
});

describe('Validate middleware — validate', () => {
  // 1. Valid body is parsed, transformed and written back to req.body
  it('should replace req.body with the parsed/coerced data and call next()', async () => {
    const req = { body: { page: '3', name: '  wax  ', extra: 'dropped' } };

    const { err, next } = await run(validate(schema), req);

    expect(err).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ page: 3, name: 'wax' });
  });

  // 2. Defaults are applied by the schema
  it('should apply schema defaults', async () => {
    const req = { body: { name: 'x' } };

    await run(validate(schema), req);

    expect(req.body).toEqual({ page: 1, name: 'x' });
  });

  // 3. The source can be switched to query or params
  it('should validate and replace req.query when source is "query"', async () => {
    const req = { query: { page: '2', name: 'q' }, body: { untouched: true } };

    const { err } = await run(validate(schema, 'query'), req);

    expect(err).toBeUndefined();
    expect(req.query).toEqual({ page: 2, name: 'q' });
    expect(req.body).toEqual({ untouched: true });
  });

  // 4. params source
  it('should validate and replace req.params when source is "params"', async () => {
    const paramsSchema = z.object({ id: z.string().length(24) });
    const req = { params: { id: '64a1f0c2e4b0a1b2c3d4e5f6' } };

    const { err } = await run(validate(paramsSchema, 'params'), req);

    expect(err).toBeUndefined();
    expect(req.params).toEqual({ id: '64a1f0c2e4b0a1b2c3d4e5f6' });
  });

  // 5. Invalid input forwards the ZodError to next() and leaves req untouched
  it('should forward a ZodError to next() and not modify req[source]', async () => {
    const original = { page: '0', name: 42 };
    const req = { body: original };

    const { err, next } = await run(validate(schema), req);

    expect(next).toHaveBeenCalledTimes(1);
    expect(err).toBeInstanceOf(z.ZodError);
    expect(err.name).toBe('ZodError');
    expect(err.issues.map((i) => i.path[0]).sort()).toEqual(['name', 'page']);
    expect(req.body).toBe(original);
  });

  // 6. A missing source object is reported as a validation error, not a crash
  it('should forward a ZodError when req[source] is undefined', async () => {
    const { err } = await run(validate(schema), {});

    expect(err).toBeInstanceOf(z.ZodError);
    expect(err.issues[0].code).toBe('invalid_type');
  });
});
