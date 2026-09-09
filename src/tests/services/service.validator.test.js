import { createServiceSchema, updateServiceSchema } from '../../validators/service.validator.js';

const CATEGORY_ID = '64a1f0c2e4b0a1b2c3d4e5f7';

describe('Services — createServiceSchema', () => {
  // 1. A minimal valid body passes with only the title
  it('should accept a body with only a title', () => {
    expect(createServiceSchema.parse({ title: 'PPF' })).toEqual({ title: 'PPF' });
  });

  // 2. Title is required and bounded by min/max length
  it('should reject a missing, too-short or too-long title', () => {
    expect(createServiceSchema.safeParse({}).success).toBe(false);
    expect(createServiceSchema.safeParse({ title: 'P' }).success).toBe(false);
    expect(createServiceSchema.safeParse({ title: 'P'.repeat(201) }).success).toBe(false);
    expect(createServiceSchema.safeParse({ title: 'P'.repeat(200) }).success).toBe(true);
  });

  // 3. Copy fields are capped at their max lengths
  it('should enforce max lengths on heading/tagline/shortDescription/enquiry/ctas/alts', () => {
    const ok = { title: 'PPF' };
    expect(createServiceSchema.safeParse({ ...ok, heading: 'h'.repeat(301) }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...ok, tagline: 't'.repeat(501) }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...ok, shortDescription: 's'.repeat(301) }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...ok, enquiry: 'e'.repeat(301) }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...ok, introHeading: 'i'.repeat(301) }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...ok, primaryCta: 'p'.repeat(301) }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...ok, benefitsHeading: 'b'.repeat(301) }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...ok, secondaryCta: 's'.repeat(301) }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...ok, heroImageAlt: 'a'.repeat(301) }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...ok, wideImageAlt: 'a'.repeat(301) }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...ok, gridImageAlt: 'a'.repeat(301) }).success).toBe(false);
    // description and introBody are unbounded
    expect(createServiceSchema.safeParse({ ...ok, description: 'd'.repeat(5000), introBody: 'b'.repeat(5000) }).success).toBe(true);
  });

  // 4. features accepts a real array or a comma-separated multipart string
  it('should coerce features from a comma-separated string and keep a real array', () => {
    expect(createServiceSchema.parse({ title: 'PPF', features: 'a, b,,c ' }).features).toEqual(['a', 'b', 'c']);
    expect(createServiceSchema.parse({ title: 'PPF', features: ['x', 'y'] }).features).toEqual(['x', 'y']);
    expect(createServiceSchema.parse({ title: 'PPF', features: '' }).features).toEqual([]);
    expect(createServiceSchema.safeParse({ title: 'PPF', features: [1] }).success).toBe(false);
  });

  // 5. category must be a 24-char id or '' (unset)
  it("should accept a 24-char category id or '' and reject other lengths", () => {
    expect(createServiceSchema.parse({ title: 'PPF', category: CATEGORY_ID }).category).toBe(CATEGORY_ID);
    expect(createServiceSchema.parse({ title: 'PPF', category: '' }).category).toBe('');
    expect(createServiceSchema.safeParse({ title: 'PPF', category: CATEGORY_ID.slice(0, 23) }).success).toBe(false);
    expect(createServiceSchema.safeParse({ title: 'PPF', category: `${CATEGORY_ID}0` }).success).toBe(false);
  });

  // 6. order is coerced to an integer; flags from 'true'/'false'
  it('should coerce order and isFeatured/isActive from multipart strings', () => {
    const result = createServiceSchema.parse({ title: 'PPF', order: '5', isFeatured: 'true', isActive: 'false' });

    expect(result).toEqual({ title: 'PPF', order: 5, isFeatured: true, isActive: false });
    expect(createServiceSchema.safeParse({ title: 'PPF', order: '5.5' }).success).toBe(false);
    expect(createServiceSchema.safeParse({ title: 'PPF', order: 'x' }).success).toBe(false);
    expect(createServiceSchema.safeParse({ title: 'PPF', isFeatured: 'yes' }).success).toBe(false);
    expect(createServiceSchema.parse({ title: 'PPF', isActive: true }).isActive).toBe(true);
  });

  // 7. introPoints / benefits accept a JSON string or a real array of {title, body}
  it('should parse introPoints and benefits from JSON strings and apply defaults', () => {
    const result = createServiceSchema.parse({
      title: 'PPF',
      introPoints: JSON.stringify([{ title: 'A', body: 'B' }, {}]),
      benefits: [{ title: 'C' }],
    });

    expect(result.introPoints).toEqual([{ title: 'A', body: 'B' }, { title: '', body: '' }]);
    expect(result.benefits).toEqual([{ title: 'C', body: '' }]);
  });

  // 8. Invalid JSON and shape violations surface on the field path
  it('should reject malformed JSON, non-array values and over-long lists', () => {
    const badJson = createServiceSchema.safeParse({ title: 'PPF', introPoints: '{not json' });
    expect(badJson.success).toBe(false);
    expect(badJson.error.issues[0].path).toEqual(['introPoints']);

    expect(createServiceSchema.safeParse({ title: 'PPF', introPoints: JSON.stringify({ title: 'x' }) }).success).toBe(false);
    expect(createServiceSchema.safeParse({ title: 'PPF', introPoints: Array.from({ length: 7 }, () => ({})) }).success).toBe(false);
    expect(createServiceSchema.safeParse({ title: 'PPF', introPoints: Array.from({ length: 6 }, () => ({})) }).success).toBe(true);
    expect(createServiceSchema.safeParse({ title: 'PPF', benefits: Array.from({ length: 13 }, () => ({})) }).success).toBe(false);
    expect(createServiceSchema.safeParse({ title: 'PPF', benefits: Array.from({ length: 12 }, () => ({})) }).success).toBe(true);
    expect(createServiceSchema.safeParse({ title: 'PPF', benefits: [{ title: 't'.repeat(201) }] }).success).toBe(false);
    expect(createServiceSchema.safeParse({ title: 'PPF', benefits: [{ body: 'b'.repeat(2001) }] }).success).toBe(false);
  });

  // 9. Slug accepts letters (any script), digits and hyphens, trimmed; '' means "derive"
  it('should accept slugish values and reject spaces or slashes', () => {
    expect(createServiceSchema.parse({ title: 'PPF', slug: ' ppf-films ' }).slug).toBe('ppf-films');
    expect(createServiceSchema.parse({ title: 'PPF', slug: 'عزل-حراري' }).slug).toBe('عزل-حراري');
    expect(createServiceSchema.parse({ title: 'PPF', slug: '' }).slug).toBe('');
    expect(createServiceSchema.safeParse({ title: 'PPF', slug: 'a b' }).success).toBe(false);
    expect(createServiceSchema.safeParse({ title: 'PPF', slug: 'a/b' }).success).toBe(false);
  });

  // 10. Image slots and other unknown keys are stripped — images only come from uploads
  it('should strip heroImage/wideImage/gridImage/collage/gallery/isDeleted from the body', () => {
    const result = createServiceSchema.parse({
      title: 'PPF', heroImage: { url: 'x' }, wideImage: { url: 'x' }, gridImage: { url: 'x' },
      collage: [{ url: 'x' }], gallery: [], image: 'x', imagePublicId: 'p', isDeleted: true,
      heroImageAlt: 'kept',
    });

    expect(result).toEqual({ title: 'PPF', heroImageAlt: 'kept' });
  });
});

describe('Services — updateServiceSchema', () => {
  // 1. Every field is optional on update
  it('should accept an empty body', () => {
    expect(updateServiceSchema.parse({})).toEqual({});
  });

  // 2. Title constraints still apply when supplied
  it('should still enforce title length when provided', () => {
    expect(updateServiceSchema.safeParse({ title: 'P' }).success).toBe(false);
    expect(updateServiceSchema.parse({ title: 'PPF' })).toEqual({ title: 'PPF' });
  });

  // 3. Slug is declared so the service can re-resolve it (including '')
  it('should keep the slug key, including an empty string', () => {
    expect(updateServiceSchema.parse({ slug: '' })).toEqual({ slug: '' });
    expect(updateServiceSchema.safeParse({ slug: 'bad slug' }).success).toBe(false);
  });

  // 4. Coercions match the create schema
  it('should coerce multipart strings on update', () => {
    const result = updateServiceSchema.parse({
      features: 'a,b', order: '2', isFeatured: 'false', category: '', benefits: JSON.stringify([{ title: 'x', body: 'y' }]),
    });

    expect(result).toEqual({ features: ['a', 'b'], order: 2, isFeatured: false, category: '', benefits: [{ title: 'x', body: 'y' }] });
  });

  // 5. Unknown keys are stripped
  it('should strip image slots and isDeleted on update', () => {
    expect(updateServiceSchema.parse({ heading: 'H', heroImage: { url: 'x' }, isDeleted: true })).toEqual({ heading: 'H' });
  });
});
