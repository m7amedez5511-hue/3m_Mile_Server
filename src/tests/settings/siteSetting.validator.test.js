import { updateSiteSettingSchema } from '../../validators/siteSetting.validator.js';

const firstPath = (result) => result.error.issues[0].path;

describe('SiteSetting validator — updateSiteSettingSchema', () => {
  // 1. Every field is optional — an empty body (image-only upload) is valid
  it('should accept an empty body', () => {
    const result = updateSiteSettingSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  // 2. A full, well-formed JSON body passes through untouched
  it('should accept a complete valid body', () => {
    const body = {
      siteName: '3M Mile', siteNameFull: '3M Mile Car Care', tagline: 't', description: 'd', siteUrl: 'https://3mmile.com',
      workingHours: '9-9', mapsEmbedId: 'abc', 'logo.alt': 'logo', 'logo.width': 120, 'logo.height': 40,
      'rating.score': '4.9', 'rating.reviewCount': 100,
      aboutTitle: 'About us', aboutDescription: 'ad', aboutFeatures: ['a', 'b'], warrantyPolicy: 'wp',
      'pageCopy.servicesIntro': 'si', 'pageCopy.branchesHeading': 'bh', 'pageCopy.branchesSub': 'bs',
      'pageCopy.shopIntro': 'sh', 'pageCopy.photoGalleryCta': 'cta',
      contactPhone: '+201000000000', contactEmail: 'info@3mmile.com', whatsappNumber: '201000000000',
      'stats.experienceYears': 10, 'stats.clientsCount': 5000, 'stats.teamMembersCount': 20,
      'socialLinks.facebook': 'fb', 'socialLinks.instagram': 'ig', 'socialLinks.tiktok': 'tt',
      'socialLinks.snapchat': 'sc', 'socialLinks.youtube': 'yt', 'socialLinks.twitter': 'tw',
    };

    const result = updateSiteSettingSchema.safeParse(body);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(body);
  });

  // 3. Multipart number strings are coerced to integers for the numeric dotted fields
  it('should coerce numeric dotted fields from multipart strings', () => {
    const result = updateSiteSettingSchema.safeParse({
      'logo.width': '120', 'logo.height': '40', 'rating.reviewCount': '7',
      'stats.experienceYears': '10', 'stats.clientsCount': '500', 'stats.teamMembersCount': '12',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      'logo.width': 120, 'logo.height': 40, 'rating.reviewCount': 7,
      'stats.experienceYears': 10, 'stats.clientsCount': 500, 'stats.teamMembersCount': 12,
    });
  });

  // 4. Numeric fields must be integers
  it('should reject non-integer or non-numeric values for numeric fields', () => {
    expect(updateSiteSettingSchema.safeParse({ 'stats.experienceYears': '1.5' }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ 'stats.clientsCount': 'many' }).success).toBe(false);
    expect(firstPath(updateSiteSettingSchema.safeParse({ 'stats.clientsCount': 'many' }))).toEqual(['stats.clientsCount']);
  });

  // 5. logo.width / logo.height must be positive
  it('should reject zero or negative logo dimensions', () => {
    expect(updateSiteSettingSchema.safeParse({ 'logo.width': '0' }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ 'logo.height': -1 }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ 'logo.width': 1 }).success).toBe(true);
  });

  // 6. rating.reviewCount allows 0 but not negatives; rating.score is a short string
  it('should allow rating.reviewCount 0, reject negatives, and cap rating.score at 10 chars', () => {
    expect(updateSiteSettingSchema.safeParse({ 'rating.reviewCount': 0 }).success).toBe(true);
    expect(updateSiteSettingSchema.safeParse({ 'rating.reviewCount': -1 }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ 'rating.score': '4.9' }).success).toBe(true);
    expect(updateSiteSettingSchema.safeParse({ 'rating.score': 4.9 }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ 'rating.score': 'a'.repeat(11) }).success).toBe(false);
  });

  // 7. aboutFeatures accepts a real array or a comma-separated string, trimming and dropping blanks
  it('should pass an aboutFeatures array through and split a comma-separated string', () => {
    expect(updateSiteSettingSchema.safeParse({ aboutFeatures: ['a', 'b'] }).data.aboutFeatures).toEqual(['a', 'b']);
    expect(updateSiteSettingSchema.safeParse({ aboutFeatures: 'a, b ,,c' }).data.aboutFeatures).toEqual(['a', 'b', 'c']);
    expect(updateSiteSettingSchema.safeParse({ aboutFeatures: '' }).data.aboutFeatures).toEqual([]);
    expect(updateSiteSettingSchema.safeParse({ aboutFeatures: [1, 2] }).success).toBe(false);
  });

  // 8. contactEmail must be a valid email, but '' is allowed so the field can be cleared
  it("should accept a valid contactEmail or '', rejecting malformed addresses", () => {
    expect(updateSiteSettingSchema.safeParse({ contactEmail: 'info@3mmile.com' }).success).toBe(true);
    expect(updateSiteSettingSchema.safeParse({ contactEmail: '' }).data.contactEmail).toBe('');
    const bad = updateSiteSettingSchema.safeParse({ contactEmail: 'not-an-email' });
    expect(bad.success).toBe(false);
    expect(firstPath(bad)).toEqual(['contactEmail']);
  });

  // 9. whatsappNumber must be an international number without leading 0/+, 10–15 digits; '' clears it
  it("should validate whatsappNumber as 10-15 digits not starting with 0, allowing ''", () => {
    expect(updateSiteSettingSchema.safeParse({ whatsappNumber: '201234567890' }).success).toBe(true);
    expect(updateSiteSettingSchema.safeParse({ whatsappNumber: '1234567890' }).success).toBe(true);
    expect(updateSiteSettingSchema.safeParse({ whatsappNumber: '' }).data.whatsappNumber).toBe('');
    expect(updateSiteSettingSchema.safeParse({ whatsappNumber: '0123456789' }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ whatsappNumber: '+201234567890' }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ whatsappNumber: '123456789' }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ whatsappNumber: '1'.repeat(16) }).success).toBe(false);
  });

  // 10. Max lengths on identity and copy fields
  it('should enforce max lengths for identity fields', () => {
    expect(updateSiteSettingSchema.safeParse({ siteName: 'a'.repeat(150) }).success).toBe(true);
    expect(updateSiteSettingSchema.safeParse({ siteName: 'a'.repeat(151) }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ siteNameFull: 'a'.repeat(201) }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ tagline: 'a'.repeat(301) }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ description: 'a'.repeat(301) }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ siteUrl: 'a'.repeat(301) }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ workingHours: 'a'.repeat(201) }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ mapsEmbedId: 'a'.repeat(201) }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ 'logo.alt': 'a'.repeat(301) }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ contactPhone: 'a'.repeat(41) }).success).toBe(false);
  });

  // 11. Max lengths on about and pageCopy fields
  it('should enforce max lengths for about and pageCopy fields', () => {
    expect(updateSiteSettingSchema.safeParse({ aboutTitle: 'a'.repeat(80) }).success).toBe(true);
    expect(updateSiteSettingSchema.safeParse({ aboutTitle: 'a'.repeat(81) }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ aboutDescription: 'a'.repeat(2001) }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ 'pageCopy.servicesIntro': 'a'.repeat(401) }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ 'pageCopy.branchesHeading': 'a'.repeat(61) }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ 'pageCopy.branchesSub': 'a'.repeat(81) }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ 'pageCopy.shopIntro': 'a'.repeat(401) }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ 'pageCopy.photoGalleryCta': 'a'.repeat(30) }).success).toBe(true);
    expect(updateSiteSettingSchema.safeParse({ 'pageCopy.photoGalleryCta': 'a'.repeat(31) }).success).toBe(false);
  });

  // 12. warrantyPolicy and socialLinks have no length cap but must be strings
  it('should accept long warrantyPolicy/socialLinks strings and reject non-strings', () => {
    expect(updateSiteSettingSchema.safeParse({ warrantyPolicy: 'a'.repeat(5000) }).success).toBe(true);
    expect(updateSiteSettingSchema.safeParse({ 'socialLinks.facebook': 'a'.repeat(1000) }).success).toBe(true);
    expect(updateSiteSettingSchema.safeParse({ 'socialLinks.facebook': 123 }).success).toBe(false);
    expect(updateSiteSettingSchema.safeParse({ warrantyPolicy: null }).success).toBe(false);
  });

  // 13. Unknown keys (media fields, singletonKey, nested objects) are stripped
  it('should strip unknown keys such as aboutImagePublicId/logo.publicId/singletonKey and nested objects', () => {
    const result = updateSiteSettingSchema.safeParse({
      siteName: 'ok', aboutImage: 'x', aboutImagePublicId: 'hack', 'logo.url': 'x', 'logo.publicId': 'hack',
      singletonKey: 'other', _id: 'id', logo: { alt: 'nested' },
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ siteName: 'ok' });
  });
});
