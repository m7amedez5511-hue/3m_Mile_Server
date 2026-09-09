import { createPartnerSchema, updatePartnerSchema } from '../../validators/partner.validator.js';

const valid = { name: 'Toyota' };
const issuePaths = (result) => result.error.issues.map((i) => i.path.join('.'));

describe('Partners — createPartnerSchema', () => {
  // 1. Minimal valid body passes and unknown keys are stripped
  it('should accept a name alone and strip unknown keys', () => {
    const result = createPartnerSchema.safeParse({ ...valid, logo: 'x', logoPublicId: 'y', isDeleted: true });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Toyota' });
  });

  // 2. name is required and bounded 2..150
  it('should require name and enforce min 2 / max 150', () => {
    expect(issuePaths(createPartnerSchema.safeParse({}))).toEqual(['name']);
    expect(createPartnerSchema.safeParse({ name: 'a' }).success).toBe(false);
    expect(createPartnerSchema.safeParse({ name: 'ab' }).success).toBe(true);
    expect(createPartnerSchema.safeParse({ name: 'a'.repeat(150) }).success).toBe(true);
    expect(createPartnerSchema.safeParse({ name: 'a'.repeat(151) }).success).toBe(false);
  });

  // 3. name must be a string
  it('should reject a non-string name', () => {
    const result = createPartnerSchema.safeParse({ name: 123 });

    expect(result.success).toBe(false);
    expect(result.error.issues[0]).toMatchObject({ path: ['name'], code: 'invalid_type' });
  });

  // 4. order coerces multipart strings to an integer and rejects fractions / garbage
  it('should coerce order to an integer and reject fractional or non-numeric values', () => {
    expect(createPartnerSchema.parse({ ...valid, order: '3' }).order).toBe(3);
    expect(createPartnerSchema.parse({ ...valid, order: 0 }).order).toBe(0);
    expect(createPartnerSchema.parse({ ...valid, order: -1 }).order).toBe(-1);
    expect(createPartnerSchema.parse(valid).order).toBeUndefined();
    expect(createPartnerSchema.safeParse({ ...valid, order: '1.5' }).success).toBe(false);
    expect(createPartnerSchema.safeParse({ ...valid, order: 'x' }).success).toBe(false);
    // multipart quirk: an empty string coerces to 0 rather than "unset"
    expect(createPartnerSchema.parse({ ...valid, order: '' }).order).toBe(0);
  });

  // 5. isActive coerces multipart strings to booleans
  it("should coerce isActive from 'true'/'false' strings and pass real booleans", () => {
    expect(createPartnerSchema.parse({ ...valid, isActive: 'true' }).isActive).toBe(true);
    expect(createPartnerSchema.parse({ ...valid, isActive: 'false' }).isActive).toBe(false);
    expect(createPartnerSchema.parse({ ...valid, isActive: true }).isActive).toBe(true);
    expect(createPartnerSchema.parse({ ...valid, isActive: false }).isActive).toBe(false);
    expect(createPartnerSchema.parse(valid).isActive).toBeUndefined();
  });

  // 6. isActive rejects anything else
  it('should reject non-boolean isActive values', () => {
    expect(createPartnerSchema.safeParse({ ...valid, isActive: 'yes' }).success).toBe(false);
    expect(createPartnerSchema.safeParse({ ...valid, isActive: 1 }).success).toBe(false);
    expect(createPartnerSchema.safeParse({ ...valid, isActive: 'TRUE' }).success).toBe(false);
  });

  // 7. Full multipart-style body coerces every field
  it('should coerce a complete multipart body', () => {
    expect(createPartnerSchema.parse({ name: 'Honda', order: '7', isActive: 'false' })).toEqual({ name: 'Honda', order: 7, isActive: false });
  });
});

describe('Partners — updatePartnerSchema', () => {
  // 1. Everything is optional on update
  it('should accept an empty body', () => {
    const result = updatePartnerSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  // 2. Provided fields keep their constraints and coercions
  it('should still validate and coerce provided fields', () => {
    expect(updatePartnerSchema.safeParse({ name: 'a' }).success).toBe(false);
    expect(updatePartnerSchema.safeParse({ name: 'a'.repeat(151) }).success).toBe(false);
    expect(updatePartnerSchema.parse({ order: '4' }).order).toBe(4);
    expect(updatePartnerSchema.parse({ isActive: 'true' }).isActive).toBe(true);
    expect(updatePartnerSchema.safeParse({ order: 'x' }).success).toBe(false);
  });
});
