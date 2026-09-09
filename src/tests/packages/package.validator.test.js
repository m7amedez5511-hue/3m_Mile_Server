import { createPackageSchema, updatePackageSchema } from '../../validators/package.validator.js';

const SERVICE_ID = '64a1f0c2e4b0a1b2c3d4e5f7';
const valid = { title: 'Gold Wash' };
const issuePaths = (result) => result.error.issues.map((i) => i.path.join('.'));

describe('Packages — createPackageSchema', () => {
  // 1. Minimal valid body passes and unknown keys are stripped
  it('should accept a title alone and strip unknown keys', () => {
    const result = createPackageSchema.safeParse({ ...valid, isDeleted: true, imagePublicId: 'x' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ title: 'Gold Wash' });
  });

  // 2. title is required and bounded 2..200
  it('should require title and enforce min 2 / max 200', () => {
    expect(issuePaths(createPackageSchema.safeParse({}))).toEqual(['title']);
    expect(createPackageSchema.safeParse({ title: 'a' }).success).toBe(false);
    expect(createPackageSchema.safeParse({ title: 'ab' }).success).toBe(true);
    expect(createPackageSchema.safeParse({ title: 'a'.repeat(200) }).success).toBe(true);
    expect(createPackageSchema.safeParse({ title: 'a'.repeat(201) }).success).toBe(false);
  });

  // 3. slug: trimmed, letters/numbers in any script and hyphens only; '' allowed (derive from title)
  it('should trim the slug, accept any-script letters/hyphens and allow an empty slug', () => {
    expect(createPackageSchema.parse({ ...valid, slug: '  gold-wash-2 ' }).slug).toBe('gold-wash-2');
    expect(createPackageSchema.parse({ ...valid, slug: 'باقة-ذهبية' }).slug).toBe('باقة-ذهبية');
    expect(createPackageSchema.parse({ ...valid, slug: '' }).slug).toBe('');
    expect(createPackageSchema.safeParse({ ...valid, slug: 'gold wash' }).success).toBe(false);
    expect(createPackageSchema.safeParse({ ...valid, slug: 'a.b' }).success).toBe(false);
    expect(createPackageSchema.safeParse({ ...valid, slug: 'a'.repeat(201) }).success).toBe(false);
  });

  // 4. service accepts a 24-char id or '' (unlink), rejects other lengths
  it("should accept a 24-char service id or '' and reject malformed ids", () => {
    expect(createPackageSchema.parse({ ...valid, service: SERVICE_ID }).service).toBe(SERVICE_ID);
    expect(createPackageSchema.parse({ ...valid, service: '' }).service).toBe('');
    expect(createPackageSchema.parse(valid).service).toBeUndefined();
    expect(createPackageSchema.safeParse({ ...valid, service: 'abc' }).success).toBe(false);
  });

  // 5. price coerces multipart strings and rejects negatives / non-numbers
  it('should coerce price from a string and enforce min 0', () => {
    expect(createPackageSchema.parse({ ...valid, price: '199.5' }).price).toBe(199.5);
    expect(createPackageSchema.parse({ ...valid, price: 0 }).price).toBe(0);
    expect(createPackageSchema.safeParse({ ...valid, price: '-1' }).success).toBe(false);
    expect(createPackageSchema.safeParse({ ...valid, price: 'abc' }).success).toBe(false);
    // multipart quirk: an empty string coerces to 0 rather than "unset"
    expect(createPackageSchema.parse({ ...valid, price: '' }).price).toBe(0);
  });

  // 6. discountPercentage coerces and is bounded 0..100
  it('should coerce discountPercentage and enforce 0..100', () => {
    expect(createPackageSchema.parse({ ...valid, discountPercentage: '15' }).discountPercentage).toBe(15);
    expect(createPackageSchema.parse({ ...valid, discountPercentage: '100' }).discountPercentage).toBe(100);
    expect(createPackageSchema.safeParse({ ...valid, discountPercentage: '101' }).success).toBe(false);
    expect(createPackageSchema.safeParse({ ...valid, discountPercentage: '-5' }).success).toBe(false);
  });

  // 7. order coerces to an integer and rejects fractions
  it('should coerce order to an integer and reject fractional values', () => {
    expect(createPackageSchema.parse({ ...valid, order: '3' }).order).toBe(3);
    expect(createPackageSchema.parse({ ...valid, order: -2 }).order).toBe(-2);
    expect(createPackageSchema.safeParse({ ...valid, order: '1.5' }).success).toBe(false);
    expect(createPackageSchema.safeParse({ ...valid, order: 'x' }).success).toBe(false);
  });

  // 8. isActive coerces multipart strings to booleans
  it("should coerce isActive from 'true'/'false' and reject other values", () => {
    expect(createPackageSchema.parse({ ...valid, isActive: 'true' }).isActive).toBe(true);
    expect(createPackageSchema.parse({ ...valid, isActive: 'false' }).isActive).toBe(false);
    expect(createPackageSchema.parse({ ...valid, isActive: false }).isActive).toBe(false);
    expect(createPackageSchema.parse(valid).isActive).toBeUndefined();
    expect(createPackageSchema.safeParse({ ...valid, isActive: 'yes' }).success).toBe(false);
    expect(createPackageSchema.safeParse({ ...valid, isActive: 1 }).success).toBe(false);
  });

  // 9. Dates coerce from ISO strings and reject blanks / garbage
  it('should coerce startDate/endDate from strings into Date objects and reject invalid dates', () => {
    const { startDate, endDate } = createPackageSchema.parse({ ...valid, startDate: '2026-01-01', endDate: '2026-02-01T10:00:00Z' });

    expect(startDate).toEqual(new Date('2026-01-01'));
    expect(endDate).toEqual(new Date('2026-02-01T10:00:00Z'));
    expect(createPackageSchema.safeParse({ ...valid, startDate: '' }).success).toBe(false);
    expect(createPackageSchema.safeParse({ ...valid, endDate: 'not-a-date' }).success).toBe(false);
  });

  // 10. endDate must be strictly after startDate when both are given
  it('should reject endDate <= startDate with an issue on endDate', () => {
    const equal = createPackageSchema.safeParse({ ...valid, startDate: '2026-01-01', endDate: '2026-01-01' });
    const before = createPackageSchema.safeParse({ ...valid, startDate: '2026-02-01', endDate: '2026-01-01' });

    expect(equal.success).toBe(false);
    expect(equal.error.issues).toEqual([expect.objectContaining({ code: 'custom', path: ['endDate'], message: 'endDate must be after startDate' })]);
    expect(before.success).toBe(false);
    expect(issuePaths(before)).toEqual(['endDate']);
  });

  // 11. A single date, or a valid range, passes the cross-field check
  it('should accept a single date or a valid range', () => {
    expect(createPackageSchema.safeParse({ ...valid, startDate: '2026-01-01' }).success).toBe(true);
    expect(createPackageSchema.safeParse({ ...valid, endDate: '2026-01-01' }).success).toBe(true);
    expect(createPackageSchema.safeParse({ ...valid, startDate: '2026-01-01', endDate: '2026-01-02' }).success).toBe(true);
  });

  // 12. Full multipart-style body coerces every field
  it('should coerce a complete multipart body', () => {
    const result = createPackageSchema.parse({
      title: 'Gold', slug: 'gold', description: 'd', service: SERVICE_ID, price: '100', discountPercentage: '10',
      startDate: '2026-01-01', endDate: '2026-03-01', order: '1', isActive: 'true',
    });

    expect(result).toEqual({
      title: 'Gold', slug: 'gold', description: 'd', service: SERVICE_ID, price: 100, discountPercentage: 10,
      startDate: new Date('2026-01-01'), endDate: new Date('2026-03-01'), order: 1, isActive: true,
    });
  });
});

describe('Packages — updatePackageSchema', () => {
  // 1. Everything is optional on update
  it('should accept an empty body', () => {
    const result = updatePackageSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  // 2. Provided fields keep their constraints and coercions
  it('should still validate and coerce provided fields', () => {
    expect(updatePackageSchema.safeParse({ title: 'a' }).success).toBe(false);
    expect(updatePackageSchema.parse({ price: '5' }).price).toBe(5);
    expect(updatePackageSchema.parse({ isActive: 'false' }).isActive).toBe(false);
    expect(updatePackageSchema.parse({ service: '' }).service).toBe('');
    expect(updatePackageSchema.safeParse({ discountPercentage: 150 }).success).toBe(false);
    expect(updatePackageSchema.safeParse({ slug: 'bad slug' }).success).toBe(false);
  });

  // 3. The endDate > startDate refine is re-applied after partial()
  it('should still reject endDate <= startDate on update', () => {
    const result = updatePackageSchema.safeParse({ startDate: '2026-02-01', endDate: '2026-01-01' });

    expect(result.success).toBe(false);
    expect(result.error.issues).toEqual([expect.objectContaining({ code: 'custom', path: ['endDate'] })]);
    expect(updatePackageSchema.safeParse({ startDate: '2026-01-01', endDate: '2026-01-02' }).success).toBe(true);
  });
});
