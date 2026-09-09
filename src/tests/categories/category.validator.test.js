import { createCategorySchema, updateCategorySchema } from '../../validators/category.validator.js';

describe('Categories — createCategorySchema', () => {
  // 1. A minimal valid body passes with only the name
  it('should accept a body with only a name', () => {
    const result = createCategorySchema.parse({ name: 'Wax' });

    expect(result).toEqual({ name: 'Wax' });
  });

  // 2. Name is required and bounded by min/max length
  it('should reject a missing, too-short or too-long name', () => {
    expect(createCategorySchema.safeParse({}).success).toBe(false);
    expect(createCategorySchema.safeParse({ name: 'W' }).success).toBe(false);
    expect(createCategorySchema.safeParse({ name: 'W'.repeat(151) }).success).toBe(false);
    expect(createCategorySchema.safeParse({ name: 'Wa' }).success).toBe(true);
    expect(createCategorySchema.safeParse({ name: 'W'.repeat(150) }).success).toBe(true);
  });

  // 3. Type is restricted to the three known values
  it('should accept product/service/blog and reject anything else', () => {
    for (const type of ['product', 'service', 'blog']) {
      expect(createCategorySchema.safeParse({ name: 'Wax', type }).success).toBe(true);
    }
    const bad = createCategorySchema.safeParse({ name: 'Wax', type: 'other' });
    expect(bad.success).toBe(false);
    expect(bad.error.issues[0].path).toEqual(['type']);
  });

  // 4. Description is capped at 1000 characters
  it('should enforce the description max length', () => {
    expect(createCategorySchema.safeParse({ name: 'Wax', description: 'd'.repeat(1000) }).success).toBe(true);
    expect(createCategorySchema.safeParse({ name: 'Wax', description: 'd'.repeat(1001) }).success).toBe(false);
  });

  // 5. Multipart strings are coerced to an integer order
  it('should coerce order from a string to an integer and reject non-integers', () => {
    expect(createCategorySchema.parse({ name: 'Wax', order: '3' }).order).toBe(3);
    expect(createCategorySchema.parse({ name: 'Wax', order: 7 }).order).toBe(7);
    expect(createCategorySchema.safeParse({ name: 'Wax', order: '3.5' }).success).toBe(false);
    expect(createCategorySchema.safeParse({ name: 'Wax', order: 'abc' }).success).toBe(false);
  });

  // 6. Multipart 'true'/'false' strings become booleans
  it("should coerce isActive from 'true'/'false' strings and real booleans", () => {
    expect(createCategorySchema.parse({ name: 'Wax', isActive: 'true' }).isActive).toBe(true);
    expect(createCategorySchema.parse({ name: 'Wax', isActive: 'false' }).isActive).toBe(false);
    expect(createCategorySchema.parse({ name: 'Wax', isActive: false }).isActive).toBe(false);
    expect(createCategorySchema.safeParse({ name: 'Wax', isActive: 'yes' }).success).toBe(false);
    expect(createCategorySchema.safeParse({ name: 'Wax', isActive: 1 }).success).toBe(false);
  });

  // 7. Slug accepts letters (any script), digits and hyphens, trimmed; '' means "derive"
  it('should accept slugish values and reject spaces or slashes', () => {
    expect(createCategorySchema.parse({ name: 'Wax', slug: ' my-slug-1 ' }).slug).toBe('my-slug-1');
    expect(createCategorySchema.parse({ name: 'Wax', slug: 'خدمة-1' }).slug).toBe('خدمة-1');
    expect(createCategorySchema.parse({ name: 'Wax', slug: '' }).slug).toBe('');
    expect(createCategorySchema.safeParse({ name: 'Wax', slug: 'a b' }).success).toBe(false);
    expect(createCategorySchema.safeParse({ name: 'Wax', slug: 'a/b' }).success).toBe(false);
    expect(createCategorySchema.safeParse({ name: 'Wax', slug: 'a'.repeat(201) }).success).toBe(false);
  });

  // 8. Unknown keys are stripped so they never reach the service layer
  it('should strip unknown keys such as isDeleted', () => {
    const result = createCategorySchema.parse({ name: 'Wax', isDeleted: true, createdAt: 'x' });

    expect(result).not.toHaveProperty('isDeleted');
    expect(result).not.toHaveProperty('createdAt');
  });
});

describe('Categories — updateCategorySchema', () => {
  // 1. Every field is optional on update
  it('should accept an empty body', () => {
    expect(updateCategorySchema.parse({})).toEqual({});
  });

  // 2. Name constraints still apply when supplied
  it('should still enforce name length when provided', () => {
    expect(updateCategorySchema.safeParse({ name: 'W' }).success).toBe(false);
    expect(updateCategorySchema.safeParse({ name: 'W'.repeat(151) }).success).toBe(false);
    expect(updateCategorySchema.parse({ name: 'Wax' }).name).toBe('Wax');
  });

  // 3. Slug is declared so the service can re-resolve it (including '')
  it('should keep the slug key, including an empty string', () => {
    expect(updateCategorySchema.parse({ slug: '' })).toEqual({ slug: '' });
    expect(updateCategorySchema.parse({ slug: 'new-slug' })).toEqual({ slug: 'new-slug' });
    expect(updateCategorySchema.safeParse({ slug: 'bad slug' }).success).toBe(false);
  });

  // 4. Coercions match the create schema
  it('should coerce order and isActive from multipart strings', () => {
    const result = updateCategorySchema.parse({ order: '10', isActive: 'false', type: 'service' });

    expect(result).toEqual({ order: 10, isActive: false, type: 'service' });
  });

  // 5. Unknown keys are stripped
  it('should strip isDeleted and other unknown keys', () => {
    const result = updateCategorySchema.parse({ name: 'Wax', isDeleted: true });

    expect(result).toEqual({ name: 'Wax' });
  });
});
