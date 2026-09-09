// Validators are pure — no mocks required.
const { createProductSchema, updateProductSchema } = await import('../../validators/product.validator.js');

const CATEGORY_ID = '64a1f0c2e4b0a1b2c3d4e5f7';

describe('Products — createProductSchema', () => {
  // 1. Minimal valid payload (name only)
  it('should accept a payload with only a name', () => {
    const result = createProductSchema.safeParse({ name: 'Wax' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Wax' });
  });

  // 2. Name is required and limited to 2..200 characters
  it('should require name and enforce the 2..200 length', () => {
    const missing = createProductSchema.safeParse({});
    expect(missing.success).toBe(false);
    expect(missing.error.issues[0].path).toEqual(['name']);

    expect(createProductSchema.safeParse({ name: 'W' }).success).toBe(false);
    expect(createProductSchema.safeParse({ name: 'x'.repeat(201) }).success).toBe(false);
    expect(createProductSchema.safeParse({ name: 'x'.repeat(200) }).success).toBe(true);
  });

  // 3. Multipart numeric strings are coerced for price / compareAtPrice / stock
  it('should coerce price, compareAtPrice and stock from strings', () => {
    const result = createProductSchema.safeParse({ name: 'Wax', price: '10', compareAtPrice: '15', stock: '3' });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ price: 10, compareAtPrice: 15, stock: 3 });
  });

  // 4. Non-numeric and negative values are rejected
  it('should reject non-numeric or negative price/compareAtPrice/stock', () => {
    const bad = createProductSchema.safeParse({ name: 'Wax', price: 'abc' });
    expect(bad.success).toBe(false);
    expect(bad.error.issues[0].path).toEqual(['price']);

    expect(createProductSchema.safeParse({ name: 'Wax', price: -1 }).success).toBe(false);
    expect(createProductSchema.safeParse({ name: 'Wax', compareAtPrice: -5 }).success).toBe(false);
    expect(createProductSchema.safeParse({ name: 'Wax', stock: -1 }).success).toBe(false);
  });

  // 5. Stock must be an integer
  it('should reject a fractional stock', () => {
    const result = createProductSchema.safeParse({ name: 'Wax', stock: '1.5' });

    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['stock']);
  });

  // 6. Empty string / null price coerce to 0 (Number('') === 0) — current behaviour
  it("should coerce '' and null price to 0", () => {
    expect(createProductSchema.safeParse({ name: 'Wax', price: '' }).data.price).toBe(0);
    expect(createProductSchema.safeParse({ name: 'Wax', price: null }).data.price).toBe(0);
  });

  // 7. Booleanish flags accept booleans and 'true'/'false' strings only
  it("should coerce isFeatured/isActive from 'true'/'false' and reject other values", () => {
    const ok = createProductSchema.safeParse({ name: 'Wax', isFeatured: 'true', isActive: 'false' });
    expect(ok.data).toMatchObject({ isFeatured: true, isActive: false });

    expect(createProductSchema.safeParse({ name: 'Wax', isFeatured: false }).data.isFeatured).toBe(false);

    const bad = createProductSchema.safeParse({ name: 'Wax', isFeatured: 'yes' });
    expect(bad.success).toBe(false);
    expect(bad.error.issues[0].path).toEqual(['isFeatured']);
    expect(createProductSchema.safeParse({ name: 'Wax', isActive: 1 }).success).toBe(false);
  });

  // 8. compareAtPrice must be strictly greater than price, issue path ['compareAtPrice']
  it('should reject compareAtPrice <= price with an issue on compareAtPrice', () => {
    const lower = createProductSchema.safeParse({ name: 'Wax', price: '10', compareAtPrice: '5' });
    expect(lower.success).toBe(false);
    expect(lower.error.issues).toHaveLength(1);
    expect(lower.error.issues[0]).toMatchObject({
      code: 'custom', path: ['compareAtPrice'], message: 'compareAtPrice must be greater than price',
    });

    const equal = createProductSchema.safeParse({ name: 'Wax', price: 10, compareAtPrice: 10 });
    expect(equal.success).toBe(false);
    expect(equal.error.issues[0].path).toEqual(['compareAtPrice']);
  });

  // 9. compareAtPrice above price is fine; either side alone skips the cross-field check
  it('should accept compareAtPrice above price and skip the check when one side is missing', () => {
    expect(createProductSchema.safeParse({ name: 'Wax', price: 10, compareAtPrice: 11 }).success).toBe(true);
    expect(createProductSchema.safeParse({ name: 'Wax', compareAtPrice: 1 }).success).toBe(true);
    expect(createProductSchema.safeParse({ name: 'Wax', price: 100 }).success).toBe(true);
  });

  // 10. Category must be a 24-char id or '' (unset)
  it("should accept a 24-char category or '' and reject other lengths", () => {
    expect(createProductSchema.safeParse({ name: 'Wax', category: CATEGORY_ID }).data.category).toBe(CATEGORY_ID);
    expect(createProductSchema.safeParse({ name: 'Wax', category: '' }).data.category).toBe('');

    const bad = createProductSchema.safeParse({ name: 'Wax', category: 'short' });
    expect(bad.success).toBe(false);
    expect(bad.error.issues[0].path).toEqual(['category']);
    expect(createProductSchema.safeParse({ name: 'Wax', category: 'x'.repeat(25) }).success).toBe(false);
  });

  // 11. Slug: trimmed, letters/digits/hyphens in any script incl. Arabic
  it('should trim the slug and accept Arabic letters, digits and hyphens only', () => {
    expect(createProductSchema.safeParse({ name: 'Wax', slug: ' wax-1 ' }).data.slug).toBe('wax-1');
    expect(createProductSchema.safeParse({ name: 'Wax', slug: ' خدمات-1 ' }).data.slug).toBe('خدمات-1');
    expect(createProductSchema.safeParse({ name: 'Wax', slug: '' }).success).toBe(true);

    const spaced = createProductSchema.safeParse({ name: 'Wax', slug: 'a b' });
    expect(spaced.success).toBe(false);
    expect(spaced.error.issues[0]).toMatchObject({ path: ['slug'], message: 'slug may contain only letters, numbers and hyphens' });
    expect(createProductSchema.safeParse({ name: 'Wax', slug: 'a_b' }).success).toBe(false);
    expect(createProductSchema.safeParse({ name: 'Wax', slug: 'a/b' }).success).toBe(false);
    expect(createProductSchema.safeParse({ name: 'Wax', slug: 'x'.repeat(201) }).success).toBe(false);
  });

  // 12. Text length caps: excerpt ≤500, shortDescription ≤2000, description unbounded
  it('should cap excerpt at 500 and shortDescription at 2000 but not description', () => {
    expect(createProductSchema.safeParse({ name: 'Wax', excerpt: 'x'.repeat(500) }).success).toBe(true);
    expect(createProductSchema.safeParse({ name: 'Wax', excerpt: 'x'.repeat(501) }).success).toBe(false);
    expect(createProductSchema.safeParse({ name: 'Wax', shortDescription: 'x'.repeat(2000) }).success).toBe(true);
    expect(createProductSchema.safeParse({ name: 'Wax', shortDescription: 'x'.repeat(2001) }).success).toBe(false);
    expect(createProductSchema.safeParse({ name: 'Wax', description: 'x'.repeat(5000) }).success).toBe(true);
  });

  // 13. sku is an optional free string
  it('should accept an optional sku string and reject a non-string sku', () => {
    expect(createProductSchema.safeParse({ name: 'Wax', sku: 'SKU-1' }).data.sku).toBe('SKU-1');
    expect(createProductSchema.safeParse({ name: 'Wax', sku: 123 }).success).toBe(false);
  });

  // 14. Unknown keys are stripped (no mass-assignment via the validator)
  it('should strip unknown keys such as isDeleted or images', () => {
    const result = createProductSchema.safeParse({ name: 'Wax', isDeleted: true, images: [{ url: 'x' }] });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Wax' });
  });
});

describe('Products — updateProductSchema', () => {
  // 1. Partial update: everything optional, empty object is valid
  it('should accept an empty object', () => {
    const result = updateProductSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  // 2. Single-field updates are valid without a name
  it('should accept single fields without requiring name', () => {
    expect(updateProductSchema.safeParse({ price: '20' }).data).toEqual({ price: 20 });
    expect(updateProductSchema.safeParse({ isActive: 'false' }).data).toEqual({ isActive: false });
    expect(updateProductSchema.safeParse({ category: '' }).data).toEqual({ category: '' });
    expect(updateProductSchema.safeParse({ compareAtPrice: 5 }).data).toEqual({ compareAtPrice: 5 });
  });

  // 3. The compareAtPrice > price refine is re-applied after partial()
  it('should still reject compareAtPrice <= price on partial updates', () => {
    const result = updateProductSchema.safeParse({ price: 10, compareAtPrice: 10 });

    expect(result.success).toBe(false);
    expect(result.error.issues[0]).toMatchObject({ code: 'custom', path: ['compareAtPrice'] });
    expect(updateProductSchema.safeParse({ price: 10, compareAtPrice: 12 }).success).toBe(true);
  });

  // 4. Field rules still apply when the field is present
  it('should still enforce field rules on provided values', () => {
    expect(updateProductSchema.safeParse({ name: 'W' }).success).toBe(false);
    expect(updateProductSchema.safeParse({ slug: 'bad slug' }).success).toBe(false);
    expect(updateProductSchema.safeParse({ excerpt: 'x'.repeat(501) }).success).toBe(false);
    expect(updateProductSchema.safeParse({ stock: '2.5' }).success).toBe(false);
    expect(updateProductSchema.safeParse({ category: 'abc' }).success).toBe(false);
  });
});
