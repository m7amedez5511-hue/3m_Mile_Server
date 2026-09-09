// Validators need no mocks: import the schema and parse.
import { updateOffersPageSchema } from '../../validators/sections.validator.js';

describe('OffersPage validator — shape and strip', () => {
  // 1. Every field is optional
  it('should accept an empty body and return an empty object', () => {
    expect(updateOffersPageSchema.parse({})).toEqual({});
  });

  // 2. Banner paths and ids are stripped (first mass-assignment layer)
  it('should strip banner, bannerPublicId, singletonKey, _id and unknown keys', () => {
    const result = updateOffersPageSchema.parse({
      intro: 'Deals', banner: 'https://cdn/b.png', bannerPublicId: 'stolen', singletonKey: 'other', _id: 'hack', foo: 1,
    });

    expect(result).toEqual({ intro: 'Deals' });
    expect(result).not.toHaveProperty('bannerPublicId');
    expect(result).not.toHaveProperty('banner');
  });

  // 3. All text fields pass through unchanged
  it('should pass through every text field', () => {
    const body = { bannerAlt: 'Banner', intro: 'Intro', formHeading: 'Form', formSubheading: 'Sub' };
    expect(updateOffersPageSchema.parse(body)).toEqual(body);
  });
});

describe('OffersPage validator — max lengths', () => {
  // 1. Boundary: exactly max passes, max+1 fails
  it.each([
    ['bannerAlt', 300],
    ['intro', 4000],
    ['formHeading', 30],
    ['formSubheading', 80],
  ])('should cap %s at %i characters', (field, max) => {
    expect(updateOffersPageSchema.safeParse({ [field]: 'x'.repeat(max) }).success).toBe(true);
    const tooLong = updateOffersPageSchema.safeParse({ [field]: 'x'.repeat(max + 1) });
    expect(tooLong.success).toBe(false);
    expect(tooLong.error.issues[0].path).toEqual([field]);
  });

  // 2. Text fields must be strings (no coercion)
  it.each([['intro', 5], ['formHeading', true], ['bannerAlt', null], ['formSubheading', ['a']]])(
    'should reject non-string %s %p',
    (field, value) => {
      expect(updateOffersPageSchema.safeParse({ [field]: value }).success).toBe(false);
    },
  );

  // 3. Empty strings are valid (clearing a field)
  it('should accept empty strings so fields can be cleared', () => {
    expect(updateOffersPageSchema.parse({ intro: '', formHeading: '' })).toEqual({ intro: '', formHeading: '' });
  });
});
