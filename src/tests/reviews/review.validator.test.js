// Validators are pure — no mocks required.
const { createReviewSchema, updateReviewSchema } = await import('../../validators/review.validator.js');

describe('Reviews — createReviewSchema', () => {
  // 1. Minimal valid payload (alt only)
  it('should accept a payload with only alt', () => {
    const result = createReviewSchema.safeParse({ alt: 'Screenshot of a 5-star review' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ alt: 'Screenshot of a 5-star review' });
  });

  // 2. alt is required
  it('should reject when alt is missing', () => {
    const result = createReviewSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['alt']);
  });

  // 3. alt length limits (2..300)
  it('should reject alt shorter than 2 or longer than 300 characters', () => {
    expect(createReviewSchema.safeParse({ alt: 'a' }).success).toBe(false);
    expect(createReviewSchema.safeParse({ alt: 'x'.repeat(301) }).success).toBe(false);
    expect(createReviewSchema.safeParse({ alt: 'x'.repeat(300) }).success).toBe(true);
    expect(createReviewSchema.safeParse({ alt: 'ab' }).success).toBe(true);
  });

  // 4. alt must be a string
  it('should reject a non-string alt', () => {
    expect(createReviewSchema.safeParse({ alt: 42 }).success).toBe(false);
  });

  // 5. order is coerced to an integer
  it('should coerce order from string and reject non-integers', () => {
    expect(createReviewSchema.safeParse({ alt: 'ok', order: '3' }).data.order).toBe(3);
    expect(createReviewSchema.safeParse({ alt: 'ok', order: 7 }).data.order).toBe(7);
    expect(createReviewSchema.safeParse({ alt: 'ok', order: '1.5' }).success).toBe(false);
    expect(createReviewSchema.safeParse({ alt: 'ok', order: 'abc' }).success).toBe(false);
  });

  // 6. isActive accepts booleans and 'true'/'false' strings only
  it("should coerce isActive from 'true'/'false' and reject other values", () => {
    expect(createReviewSchema.safeParse({ alt: 'ok', isActive: 'true' }).data.isActive).toBe(true);
    expect(createReviewSchema.safeParse({ alt: 'ok', isActive: 'false' }).data.isActive).toBe(false);
    expect(createReviewSchema.safeParse({ alt: 'ok', isActive: true }).data.isActive).toBe(true);
    expect(createReviewSchema.safeParse({ alt: 'ok', isActive: 'yes' }).success).toBe(false);
    expect(createReviewSchema.safeParse({ alt: 'ok', isActive: 1 }).success).toBe(false);
  });

  // 7. Unknown keys are stripped (zod object default)
  it('should strip unknown keys such as image or isDeleted', () => {
    const result = createReviewSchema.safeParse({ alt: 'ok', image: 'x.png', isDeleted: true });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ alt: 'ok' });
  });
});

describe('Reviews — updateReviewSchema', () => {
  // 1. Partial update: everything optional, empty object is valid
  it('should accept an empty object', () => {
    const result = updateReviewSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  // 2. Single-field update is valid without alt
  it('should accept a single field without requiring alt', () => {
    expect(updateReviewSchema.safeParse({ isActive: 'false' }).data).toEqual({ isActive: false });
    expect(updateReviewSchema.safeParse({ order: '2' }).data).toEqual({ order: 2 });
  });

  // 3. Field rules still apply when the field is present
  it('should still enforce alt limits when alt is provided', () => {
    expect(updateReviewSchema.safeParse({ alt: 'a' }).success).toBe(false);
    expect(updateReviewSchema.safeParse({ alt: 'x'.repeat(301) }).success).toBe(false);
    expect(updateReviewSchema.safeParse({ alt: 'fine' }).success).toBe(true);
  });
});
