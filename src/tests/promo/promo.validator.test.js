// Validators need no mocks: import the schema and parse.
import { updatePromoSchema } from '../../validators/sections.validator.js';

describe('Promo validator — shape and strip', () => {
  // 1. Every field is optional
  it('should accept an empty body and return an empty object', () => {
    expect(updatePromoSchema.parse({})).toEqual({});
  });

  // 2. Media paths and ids are stripped (first mass-assignment layer)
  it('should strip image, imagePublicId, singletonKey, _id and unknown keys', () => {
    const result = updatePromoSchema.parse({
      alt: 'Sale', image: 'https://cdn/x.png', imagePublicId: 'stolen', singletonKey: 'other', _id: 'hack', foo: 'bar',
    });

    expect(result).toEqual({ alt: 'Sale' });
    expect(result).not.toHaveProperty('imagePublicId');
    expect(result).not.toHaveProperty('image');
  });

  // 3. A full valid JSON body passes through with native types
  it('should accept a JSON body with native types', () => {
    const body = { alt: 'Sale', width: 800, height: 600, whatsappText: 'Hi', delayMs: 3000, isActive: true };
    expect(updatePromoSchema.parse(body)).toEqual(body);
  });
});

describe('Promo validator — multipart coercions', () => {
  // 1. Strings from multipart are coerced to numbers/booleans
  it('should coerce string numbers and booleans', () => {
    expect(updatePromoSchema.parse({ width: '800', height: '600', delayMs: '1500', isActive: 'true' }))
      .toEqual({ width: 800, height: 600, delayMs: 1500, isActive: true });
    expect(updatePromoSchema.parse({ isActive: 'false' })).toEqual({ isActive: false });
    expect(updatePromoSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });

  // 2. Only 'true'/'false' or real booleans are accepted for isActive
  it.each(['yes', '1', 1, 0, 'TRUE', null])('should reject isActive %p', (value) => {
    expect(updatePromoSchema.safeParse({ isActive: value }).success).toBe(false);
  });

  // 3. width/height must be positive integers
  it.each(['0', '-1', '1.5', 'abc', ''])('should reject width %p', (value) => {
    expect(updatePromoSchema.safeParse({ width: value }).success).toBe(false);
    expect(updatePromoSchema.safeParse({ height: value }).success).toBe(false);
  });
});

describe('Promo validator — delayMs clamp', () => {
  // 1. Inclusive boundaries 0 and 30000
  it('should accept 0 and 30000 inclusive', () => {
    expect(updatePromoSchema.parse({ delayMs: '0' })).toEqual({ delayMs: 0 });
    expect(updatePromoSchema.parse({ delayMs: 30000 })).toEqual({ delayMs: 30000 });
  });

  // 2. Outside the clamp or non-integer is rejected
  it.each(['-1', '30001', '2.5', 'soon'])('should reject delayMs %p', (value) => {
    const result = updatePromoSchema.safeParse({ delayMs: value });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['delayMs']);
  });

  // 3. Current behaviour: z.coerce.number() turns null into 0, so null is not rejected
  //    but silently becomes an instant (0 ms) delay.
  it('should coerce a null delayMs to 0 rather than reject it', () => {
    expect(updatePromoSchema.parse({ delayMs: null })).toEqual({ delayMs: 0 });
  });
});

describe('Promo validator — max lengths', () => {
  // 1. alt and whatsappText are capped at 300
  it.each([['alt', 300], ['whatsappText', 300]])('should cap %s at %i characters', (field, max) => {
    expect(updatePromoSchema.safeParse({ [field]: 'x'.repeat(max) }).success).toBe(true);
    const tooLong = updatePromoSchema.safeParse({ [field]: 'x'.repeat(max + 1) });
    expect(tooLong.success).toBe(false);
    expect(tooLong.error.issues[0].path).toEqual([field]);
  });

  // 2. Text fields must be strings
  it('should reject a non-string alt', () => {
    expect(updatePromoSchema.safeParse({ alt: 5 }).success).toBe(false);
  });
});
