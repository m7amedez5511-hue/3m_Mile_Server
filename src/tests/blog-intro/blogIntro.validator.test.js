// Validators need no mocks: import the schema and parse.
import { updateBlogIntroSchema } from '../../validators/sections.validator.js';

describe('BlogIntro validator — shape and strip', () => {
  // 1. Every field is optional
  it('should accept an empty body and return an empty object', () => {
    expect(updateBlogIntroSchema.parse({})).toEqual({});
  });

  // 2. Image paths and ids are stripped (first mass-assignment layer)
  it('should strip image, imagePublicId, singletonKey, _id and unknown keys', () => {
    const result = updateBlogIntroSchema.parse({
      heading: 'Blog', image: 'https://cdn/b.png', imagePublicId: 'stolen', singletonKey: 'other', _id: 'hack', foo: 1,
    });

    expect(result).toEqual({ heading: 'Blog' });
    expect(result).not.toHaveProperty('imagePublicId');
    expect(result).not.toHaveProperty('image');
  });

  // 3. All text fields pass through unchanged
  it('should pass through every text field', () => {
    const body = { heading: 'Blog', description: 'Latest posts', imageAlt: 'Banner' };
    expect(updateBlogIntroSchema.parse(body)).toEqual(body);
  });
});

describe('BlogIntro validator — max lengths', () => {
  // 1. Boundary: exactly max passes, max+1 fails
  it.each([
    ['heading', 30],
    ['description', 80],
    ['imageAlt', 300],
  ])('should cap %s at %i characters', (field, max) => {
    expect(updateBlogIntroSchema.safeParse({ [field]: 'x'.repeat(max) }).success).toBe(true);
    const tooLong = updateBlogIntroSchema.safeParse({ [field]: 'x'.repeat(max + 1) });
    expect(tooLong.success).toBe(false);
    expect(tooLong.error.issues[0].path).toEqual([field]);
  });

  // 2. Text fields must be strings (no coercion)
  it.each([['heading', 5], ['description', true], ['imageAlt', null]])('should reject non-string %s %p', (field, value) => {
    expect(updateBlogIntroSchema.safeParse({ [field]: value }).success).toBe(false);
  });

  // 3. Empty strings are valid (clearing a field)
  it('should accept empty strings so fields can be cleared', () => {
    expect(updateBlogIntroSchema.parse({ heading: '', imageAlt: '' })).toEqual({ heading: '', imageAlt: '' });
  });
});
