// Validators need no mocks: import the schema and parse.
import { updateGalleryIntroSchema } from '../../validators/sections.validator.js';

describe('GalleryIntro validator — shape and strip', () => {
  // 1. Every field is optional
  it('should accept an empty body and return an empty object', () => {
    expect(updateGalleryIntroSchema.parse({})).toEqual({});
  });

  // 2. Unknown keys — including a nested object form of the same data — are stripped
  it('should strip singletonKey, _id, nested objects and unknown keys', () => {
    const result = updateGalleryIntroSchema.parse({
      'video.heading': 'Videos', video: { heading: 'nested' }, singletonKey: 'other', _id: 'hack', foo: 1,
    });

    expect(result).toEqual({ 'video.heading': 'Videos' });
    expect(result).not.toHaveProperty('video');
    expect(result).not.toHaveProperty('singletonKey');
  });

  // 3. All dotted text fields pass through unchanged
  it('should pass through every dotted text field', () => {
    const body = {
      'video.heading': 'Videos', 'video.description': 'Our video work',
      'photo.heading': 'Photos', 'photo.description': 'Our photo work',
    };
    expect(updateGalleryIntroSchema.parse(body)).toEqual(body);
  });
});

describe('GalleryIntro validator — max lengths', () => {
  // 1. Boundary: exactly max passes, max+1 fails
  it.each([
    ['video.heading', 30],
    ['video.description', 80],
    ['photo.heading', 30],
    ['photo.description', 80],
  ])('should cap %s at %i characters', (field, max) => {
    expect(updateGalleryIntroSchema.safeParse({ [field]: 'x'.repeat(max) }).success).toBe(true);
    const tooLong = updateGalleryIntroSchema.safeParse({ [field]: 'x'.repeat(max + 1) });
    expect(tooLong.success).toBe(false);
    expect(tooLong.error.issues[0].path).toEqual([field]);
  });

  // 2. Text fields must be strings (no coercion)
  it.each([['video.heading', 5], ['photo.description', true], ['photo.heading', null]])(
    'should reject non-string %s %p',
    (field, value) => {
      expect(updateGalleryIntroSchema.safeParse({ [field]: value }).success).toBe(false);
    },
  );

  // 3. Empty strings are valid (clearing a field)
  it('should accept empty strings so fields can be cleared', () => {
    expect(updateGalleryIntroSchema.parse({ 'video.heading': '' })).toEqual({ 'video.heading': '' });
  });
});
