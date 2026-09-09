import { z } from 'zod';

// Validators are pure — no mocks required.
const { booleanish, listish, jsonish, numberish, slugish, titleBody } = await import('../../validators/shared.validator.js');

describe('Shared validators — booleanish', () => {
  // 1. Real booleans pass through
  it('should accept real booleans', () => {
    expect(booleanish.parse(true)).toBe(true);
    expect(booleanish.parse(false)).toBe(false);
  });

  // 2. 'true' / 'false' strings are coerced
  it("should coerce 'true' and 'false' strings", () => {
    expect(booleanish.parse('true')).toBe(true);
    expect(booleanish.parse('false')).toBe(false);
  });

  // 3. Anything else is rejected (no loose truthiness)
  it('should reject other strings, numbers and null', () => {
    for (const bad of ['yes', 'TRUE', '1', '', 1, 0, null, undefined]) {
      expect(booleanish.safeParse(bad).success).toBe(false);
    }
  });
});

describe('Shared validators — listish', () => {
  // 1. A real array of strings passes through unchanged
  it('should pass an array of strings through', () => {
    expect(listish.parse(['a', 'b'])).toEqual(['a', 'b']);
    expect(listish.parse([])).toEqual([]);
  });

  // 2. Comma-separated string is split, trimmed and emptied of blanks
  it('should split a comma-separated string, trimming and dropping blanks', () => {
    expect(listish.parse(' a, b,,c ')).toEqual(['a', 'b', 'c']);
    expect(listish.parse('single')).toEqual(['single']);
    expect(listish.parse('')).toEqual([]);
    expect(listish.parse(',,,')).toEqual([]);
  });

  // 3. Arrays with non-string members and non-string/array inputs are rejected
  it('should reject arrays of non-strings and non-string inputs', () => {
    expect(listish.safeParse([1, 2]).success).toBe(false);
    expect(listish.safeParse(42).success).toBe(false);
    expect(listish.safeParse({ a: 1 }).success).toBe(false);
  });
});

describe('Shared validators — jsonish', () => {
  const schema = jsonish(z.array(z.object({ a: z.string() })));

  // 1. Valid JSON string is parsed and validated against the wrapped schema
  it('should parse a JSON string and validate it', () => {
    expect(schema.parse('[{"a":"x"}]')).toEqual([{ a: 'x' }]);
  });

  // 2. Already-structured values bypass JSON.parse
  it('should pass a real array straight to the wrapped schema', () => {
    expect(schema.parse([{ a: 'y' }])).toEqual([{ a: 'y' }]);
  });

  // 3. Invalid JSON falls through so the wrapped schema reports the type error
  it('should let the wrapped schema fail on invalid JSON', () => {
    const result = schema.safeParse('{not json');

    expect(result.success).toBe(false);
    expect(result.error.issues[0].code).toBe('invalid_type');
  });

  // 4. Valid JSON with the wrong shape fails on the shape
  it('should fail when the parsed JSON does not match the schema', () => {
    const result = schema.safeParse('[{"a":1}]');

    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual([0, 'a']);
  });

  // 5. Works with an object schema too
  it('should support nested object schemas', () => {
    const objSchema = jsonish(z.object({ n: z.number() }));

    expect(objSchema.parse('{"n":3}')).toEqual({ n: 3 });
    expect(objSchema.safeParse('"just a string"').success).toBe(false);
  });
});

describe('Shared validators — numberish', () => {
  // 1. Numeric strings are coerced
  it('should coerce numeric strings', () => {
    expect(numberish.parse('12.5')).toBe(12.5);
    expect(numberish.parse('-3')).toBe(-3);
    expect(numberish.parse(7)).toBe(7);
  });

  // 2. Non-numeric strings fail (NaN)
  it('should reject non-numeric strings', () => {
    const result = numberish.safeParse('x');

    expect(result.success).toBe(false);
    expect(result.error.issues[0].code).toBe('invalid_type');
  });

  // 3. Empty string coerces to 0 (Number('') === 0) — current behaviour
  it("should coerce '' to 0", () => {
    expect(numberish.parse('')).toBe(0);
  });
});

describe('Shared validators — slugish', () => {
  // 1. Trimmed, letters/digits/hyphens in any script
  it('should trim and accept letters, digits and hyphens in any script', () => {
    expect(slugish.parse(' a-b ')).toBe('a-b');
    expect(slugish.parse('خدمات-1')).toBe('خدمات-1');
    expect(slugish.parse('café-2')).toBe('café-2');
    expect(slugish.parse('ABC123')).toBe('ABC123');
  });

  // 2. Empty string is allowed (means "derive from title")
  it('should accept an empty string', () => {
    expect(slugish.parse('')).toBe('');
    expect(slugish.parse('   ')).toBe('');
  });

  // 3. Spaces, underscores, slashes and other punctuation are rejected with the custom message
  it('should reject spaces, underscores, slashes and punctuation', () => {
    for (const bad of ['a b', 'a_b', 'a/b', 'a.b', 'a?b', 'a@b']) {
      const result = slugish.safeParse(bad);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('slug may contain only letters, numbers and hyphens');
    }
  });

  // 4. Max 200 characters
  it('should cap the slug at 200 characters', () => {
    expect(slugish.safeParse('a'.repeat(200)).success).toBe(true);
    expect(slugish.safeParse('a'.repeat(201)).success).toBe(false);
  });

  // 5. Non-strings are rejected
  it('should reject non-string input', () => {
    expect(slugish.safeParse(5).success).toBe(false);
    expect(slugish.safeParse(null).success).toBe(false);
  });
});

describe('Shared validators — titleBody', () => {
  // 1. Both fields default to ''
  it("should default title and body to ''", () => {
    expect(titleBody.parse({})).toEqual({ title: '', body: '' });
  });

  // 2. Provided values are kept
  it('should keep provided title and body', () => {
    expect(titleBody.parse({ title: 'T', body: 'B' })).toEqual({ title: 'T', body: 'B' });
  });

  // 3. Length caps: title ≤200, body ≤2000
  it('should cap title at 200 and body at 2000 characters', () => {
    expect(titleBody.safeParse({ title: 'x'.repeat(200) }).success).toBe(true);
    expect(titleBody.safeParse({ title: 'x'.repeat(201) }).success).toBe(false);
    expect(titleBody.safeParse({ body: 'x'.repeat(2000) }).success).toBe(true);
    expect(titleBody.safeParse({ body: 'x'.repeat(2001) }).success).toBe(false);
  });

  // 4. Non-string fields are rejected
  it('should reject non-string title or body', () => {
    expect(titleBody.safeParse({ title: 1 }).success).toBe(false);
    expect(titleBody.safeParse({ body: null }).success).toBe(false);
  });
});
