// Validators are pure — no mocks required.
const { createWarrantyGroupSchema, updateWarrantyGroupSchema } = await import('../../validators/warrantyGroup.validator.js');

const validTier = { title: 'Basic', warranty: '1 year', maintenance: 'Every 6 months', terms: ['No misuse'] };

describe('WarrantyGroups — createWarrantyGroupSchema', () => {
  // 1. Minimal valid payload
  it('should accept a payload with only a title', () => {
    const result = createWarrantyGroupSchema.safeParse({ title: 'Gold' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ title: 'Gold' });
  });

  // 2. Title length limits (2..200)
  it('should reject a title shorter than 2 or longer than 200 characters', () => {
    expect(createWarrantyGroupSchema.safeParse({ title: 'G' }).success).toBe(false);
    expect(createWarrantyGroupSchema.safeParse({ title: 'x'.repeat(201) }).success).toBe(false);
    expect(createWarrantyGroupSchema.safeParse({ title: 'x'.repeat(200) }).success).toBe(true);
  });

  // 3. Title is required
  it('should reject when title is missing', () => {
    const result = createWarrantyGroupSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['title']);
  });

  // 4. Slug follows the slugish rules (trimmed, letters/digits/hyphens incl. Arabic)
  it('should trim the slug and accept Arabic letters, digits and hyphens', () => {
    expect(createWarrantyGroupSchema.safeParse({ title: 'Gold', slug: ' gold-1 ' }).data.slug).toBe('gold-1');
    expect(createWarrantyGroupSchema.safeParse({ title: 'Gold', slug: 'ضمان-ذهبي' }).success).toBe(true);
    expect(createWarrantyGroupSchema.safeParse({ title: 'Gold', slug: '' }).success).toBe(true);
    expect(createWarrantyGroupSchema.safeParse({ title: 'Gold', slug: 'a b' }).success).toBe(false);
    expect(createWarrantyGroupSchema.safeParse({ title: 'Gold', slug: 'a/b' }).success).toBe(false);
  });

  // 5. Intro is capped at 2000 characters
  it('should cap intro at 2000 characters', () => {
    expect(createWarrantyGroupSchema.safeParse({ title: 'Gold', intro: 'x'.repeat(2000) }).success).toBe(true);
    expect(createWarrantyGroupSchema.safeParse({ title: 'Gold', intro: 'x'.repeat(2001) }).success).toBe(false);
  });

  // 6. Tiers accept a real array and apply per-tier defaults
  it('should accept tiers as an array and fill tier defaults', () => {
    const result = createWarrantyGroupSchema.safeParse({ title: 'Gold', tiers: [{ title: 'Basic' }] });

    expect(result.success).toBe(true);
    expect(result.data.tiers).toEqual([{ title: 'Basic', warranty: '', maintenance: '', terms: [] }]);
  });

  // 7. Tiers accept a JSON string (multipart) and parse it
  it('should parse tiers sent as a JSON string', () => {
    const result = createWarrantyGroupSchema.safeParse({ title: 'Gold', tiers: JSON.stringify([validTier]) });

    expect(result.success).toBe(true);
    expect(result.data.tiers).toEqual([validTier]);
  });

  // 8. Malformed JSON for tiers surfaces as a validation error on tiers
  it('should reject tiers that is not valid JSON', () => {
    const result = createWarrantyGroupSchema.safeParse({ title: 'Gold', tiers: '{not json' });

    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['tiers']);
  });

  // 9. Tier shape limits: title 1..200, warranty ≤500, maintenance ≤1000, terms ≤30 items each ≤1000
  it('should enforce tier field limits', () => {
    const base = { title: 'Gold' };
    expect(createWarrantyGroupSchema.safeParse({ ...base, tiers: [{ title: '' }] }).success).toBe(false);
    expect(createWarrantyGroupSchema.safeParse({ ...base, tiers: [{ title: 'x'.repeat(201) }] }).success).toBe(false);
    expect(createWarrantyGroupSchema.safeParse({ ...base, tiers: [{ title: 'T', warranty: 'x'.repeat(501) }] }).success).toBe(false);
    expect(createWarrantyGroupSchema.safeParse({ ...base, tiers: [{ title: 'T', maintenance: 'x'.repeat(1001) }] }).success).toBe(false);
    expect(createWarrantyGroupSchema.safeParse({ ...base, tiers: [{ title: 'T', terms: Array(31).fill('t') }] }).success).toBe(false);
    expect(createWarrantyGroupSchema.safeParse({ ...base, tiers: [{ title: 'T', terms: ['x'.repeat(1001)] }] }).success).toBe(false);
    expect(createWarrantyGroupSchema.safeParse({ ...base, tiers: [{ title: 'T', terms: Array(30).fill('t') }] }).success).toBe(true);
  });

  // 10. At most 20 tiers
  it('should reject more than 20 tiers', () => {
    expect(createWarrantyGroupSchema.safeParse({ title: 'Gold', tiers: Array(21).fill({ title: 'T' }) }).success).toBe(false);
    expect(createWarrantyGroupSchema.safeParse({ title: 'Gold', tiers: Array(20).fill({ title: 'T' }) }).success).toBe(true);
  });

  // 11. Order is coerced to an integer
  it('should coerce order from string and reject non-integers', () => {
    expect(createWarrantyGroupSchema.safeParse({ title: 'Gold', order: '3' }).data.order).toBe(3);
    expect(createWarrantyGroupSchema.safeParse({ title: 'Gold', order: '1.5' }).success).toBe(false);
    expect(createWarrantyGroupSchema.safeParse({ title: 'Gold', order: 'abc' }).success).toBe(false);
  });

  // 12. isActive accepts booleans and 'true'/'false' strings only
  it("should coerce isActive from 'true'/'false' and reject other strings", () => {
    expect(createWarrantyGroupSchema.safeParse({ title: 'Gold', isActive: 'true' }).data.isActive).toBe(true);
    expect(createWarrantyGroupSchema.safeParse({ title: 'Gold', isActive: 'false' }).data.isActive).toBe(false);
    expect(createWarrantyGroupSchema.safeParse({ title: 'Gold', isActive: false }).data.isActive).toBe(false);
    expect(createWarrantyGroupSchema.safeParse({ title: 'Gold', isActive: 'yes' }).success).toBe(false);
  });
});

describe('WarrantyGroups — updateWarrantyGroupSchema', () => {
  // 1. Partial update: everything optional, empty object is valid
  it('should accept an empty object', () => {
    const result = updateWarrantyGroupSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  // 2. Single-field update is valid without a title
  it('should accept a single field without requiring title', () => {
    expect(updateWarrantyGroupSchema.safeParse({ isActive: 'false' }).data).toEqual({ isActive: false });
    expect(updateWarrantyGroupSchema.safeParse({ order: '7' }).data).toEqual({ order: 7 });
  });

  // 3. Field rules still apply when the field is present
  it('should still enforce field rules on provided values', () => {
    expect(updateWarrantyGroupSchema.safeParse({ title: 'G' }).success).toBe(false);
    expect(updateWarrantyGroupSchema.safeParse({ slug: 'bad slug' }).success).toBe(false);
    expect(updateWarrantyGroupSchema.safeParse({ tiers: '[{"title":""}]' }).success).toBe(false);
  });
});
