import { createGalleryItemSchema, updateGalleryItemSchema } from '../../validators/galleryItem.validator.js';

const SERVICE_ID = '64a1f0c2e4b0a1b2c3d4e5f7';
const YT_ID = 'dQw4w9WgXcQ';
const firstPath = (result) => result.error.issues[0].path;

describe('GalleryItem validator — createGalleryItemSchema', () => {
  // 1. Every field is optional — an empty body (file-only upload) is valid
  it('should accept an empty body', () => {
    const result = createGalleryItemSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  // 2. A full, well-formed JSON body passes through untouched
  it('should accept a complete valid body', () => {
    const body = {
      title: 'Before/After', type: 'video', description: 'd', alt: 'a', href: '/services/x',
      externalId: YT_ID, service: SERVICE_ID, order: 2, isActive: true,
    };

    const result = createGalleryItemSchema.safeParse(body);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(body);
  });

  // 3. Multipart strings are coerced: order → number, isActive 'true'/'false' → boolean
  it('should coerce multipart string values for order and isActive', () => {
    const result = createGalleryItemSchema.safeParse({ order: '5', isActive: 'false' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ order: 5, isActive: false });
  });

  // 4. Current behaviour: an empty multipart order field coerces to 0
  it("should coerce order '' to 0", () => {
    const result = createGalleryItemSchema.safeParse({ order: '' });

    expect(result.success).toBe(true);
    expect(result.data.order).toBe(0);
  });

  // 5. order must be an integer
  it('should reject a non-integer or non-numeric order', () => {
    expect(createGalleryItemSchema.safeParse({ order: '1.5' }).success).toBe(false);
    expect(createGalleryItemSchema.safeParse({ order: 'abc' }).success).toBe(false);
    expect(firstPath(createGalleryItemSchema.safeParse({ order: 'abc' }))).toEqual(['order']);
  });

  // 6. isActive accepts only booleans or the literal strings 'true'/'false'
  it("should reject isActive values other than boolean or 'true'/'false'", () => {
    expect(createGalleryItemSchema.safeParse({ isActive: 'yes' }).success).toBe(false);
    expect(createGalleryItemSchema.safeParse({ isActive: 1 }).success).toBe(false);
    expect(createGalleryItemSchema.safeParse({ isActive: true }).data.isActive).toBe(true);
    expect(createGalleryItemSchema.safeParse({ isActive: 'true' }).data.isActive).toBe(true);
  });

  // 7. type is limited to image | video
  it('should accept only image or video for type', () => {
    expect(createGalleryItemSchema.safeParse({ type: 'image' }).success).toBe(true);
    expect(createGalleryItemSchema.safeParse({ type: 'video' }).success).toBe(true);
    const bad = createGalleryItemSchema.safeParse({ type: 'audio' });
    expect(bad.success).toBe(false);
    expect(firstPath(bad)).toEqual(['type']);
  });

  // 8. externalId must be an 11-char YouTube id; '' is allowed (clearing); a full URL is rejected
  it('should validate externalId as an 11-character YouTube id, allowing empty string', () => {
    expect(createGalleryItemSchema.safeParse({ externalId: YT_ID }).success).toBe(true);
    expect(createGalleryItemSchema.safeParse({ externalId: '' }).data.externalId).toBe('');
    expect(createGalleryItemSchema.safeParse({ externalId: 'abc_-XYZ012' }).success).toBe(true);

    const url = createGalleryItemSchema.safeParse({ externalId: `https://youtu.be/${YT_ID}` });
    expect(url.success).toBe(false);
    expect(firstPath(url)).toEqual(['externalId']);
    expect(createGalleryItemSchema.safeParse({ externalId: 'short' }).success).toBe(false);
    expect(createGalleryItemSchema.safeParse({ externalId: 'a'.repeat(12) }).success).toBe(false);
  });

  // 9. service must be exactly 24 characters and may not be null on create
  it('should require service to be a 24-character string and reject null on create', () => {
    expect(createGalleryItemSchema.safeParse({ service: SERVICE_ID }).success).toBe(true);
    expect(createGalleryItemSchema.safeParse({ service: '' }).success).toBe(false);
    expect(createGalleryItemSchema.safeParse({ service: 'abc' }).success).toBe(false);
    expect(createGalleryItemSchema.safeParse({ service: null }).success).toBe(false);
  });

  // 10. Max lengths: title 200, alt 300, href 500, description 2000
  it('should enforce max lengths for title/alt/href/description', () => {
    expect(createGalleryItemSchema.safeParse({ title: 'a'.repeat(200) }).success).toBe(true);
    expect(createGalleryItemSchema.safeParse({ title: 'a'.repeat(201) }).success).toBe(false);
    expect(createGalleryItemSchema.safeParse({ alt: 'a'.repeat(300) }).success).toBe(true);
    expect(createGalleryItemSchema.safeParse({ alt: 'a'.repeat(301) }).success).toBe(false);
    expect(createGalleryItemSchema.safeParse({ href: 'a'.repeat(500) }).success).toBe(true);
    expect(createGalleryItemSchema.safeParse({ href: 'a'.repeat(501) }).success).toBe(false);
    expect(createGalleryItemSchema.safeParse({ description: 'a'.repeat(2000) }).success).toBe(true);
    expect(createGalleryItemSchema.safeParse({ description: 'a'.repeat(2001) }).success).toBe(false);
  });

  // 11. Unknown keys (url, publicId, isDeleted, ...) are stripped, never forwarded
  it('should strip unknown keys such as url/publicId/isDeleted', () => {
    const result = createGalleryItemSchema.safeParse({ title: 'x', url: 'https://evil', publicId: 'hack', isDeleted: true });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ title: 'x' });
  });
});

describe('GalleryItem validator — updateGalleryItemSchema', () => {
  // 1. Same shape as create: partial metadata passes and is coerced
  it('should accept a partial body and coerce multipart values', () => {
    const result = updateGalleryItemSchema.safeParse({ title: 'New', order: '9', isActive: 'true' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ title: 'New', order: 9, isActive: true });
  });

  // 2. service may be null on update so the admin can untag the item
  it('should accept service null on update', () => {
    const result = updateGalleryItemSchema.safeParse({ service: null });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ service: null });
  });

  // 3. service still has to be 24 characters when it is a string
  it('should still reject a malformed service string on update', () => {
    expect(updateGalleryItemSchema.safeParse({ service: SERVICE_ID }).success).toBe(true);
    expect(updateGalleryItemSchema.safeParse({ service: 'bad' }).success).toBe(false);
  });

  // 4. externalId rules carry over to update
  it('should validate externalId on update the same way as create', () => {
    expect(updateGalleryItemSchema.safeParse({ externalId: YT_ID }).success).toBe(true);
    expect(updateGalleryItemSchema.safeParse({ externalId: '' }).success).toBe(true);
    expect(updateGalleryItemSchema.safeParse({ externalId: 'not-a-yt-id!' }).success).toBe(false);
  });

  // 5. Unknown keys are stripped on update too
  it('should strip unknown keys on update', () => {
    const result = updateGalleryItemSchema.safeParse({ alt: 'a', type_hack: 1, thumbnailUrl: 'x' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ alt: 'a' });
  });
});
