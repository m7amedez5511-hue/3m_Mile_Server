import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockCrud = {
  findOneAndUpdate: jest.fn(),
};
const mockSafeDelete = jest.fn().mockResolvedValue(undefined);
const mockLogAudit = jest.fn();
const mockActorFromReq = jest.fn(() => ({ userId: 'admin-id', ip: '127.0.0.1' }));
const mockGetOrCreateSingleton = jest.fn();
const MockModel = { modelName: 'SiteSetting' };
const mockModel = jest.fn(() => MockModel);

jest.unstable_mockModule('../../services/crud.service.js', () => ({ default: () => mockCrud }));
jest.unstable_mockModule('../../utils/softDeleteImage.js', () => ({ safeDeleteCloudinaryImage: mockSafeDelete }));
jest.unstable_mockModule('../../utils/auditLogger.js', () => ({ logAudit: mockLogAudit, actorFromReq: mockActorFromReq }));
jest.unstable_mockModule('../../utils/singletonUpsert.js', () => ({ getOrCreateSingleton: mockGetOrCreateSingleton }));
jest.unstable_mockModule('mongoose', () => ({
  default: {
    model: mockModel,
    isValidObjectId: (v) => /^[0-9a-f]{24}$/i.test(String(v)),
    Types: { ObjectId: class { constructor(v) { this.v = v; } toString() { return this.v; } } },
  },
}));

const { getSiteSettings, updateSiteSettings } = await import('../../services/siteSetting.service.js');

const SETTINGS_ID = '64a1f0c2e4b0a1b2c3d4e5f6';
const mockReq = (body = {}, extra = {}) => ({ body, ip: '127.0.0.1', user: { _id: 'admin-id' }, ...extra });
const existing = {
  _id: SETTINGS_ID,
  singletonKey: 'main',
  siteName: '3M Mile',
  aboutImage: null,
  aboutImagePublicId: null,
  logo: { url: null, publicId: null, alt: '', width: null, height: null },
};

describe('SiteSettings — getSiteSettings', () => {
  // 1. The singleton is fetched (or created) through the shared helper on the SiteSetting model
  it('should resolve the SiteSetting model and pass it to getOrCreateSingleton', async () => {
    mockGetOrCreateSingleton.mockResolvedValue(existing);

    const result = await getSiteSettings();

    expect(mockModel).toHaveBeenCalledWith('SiteSetting');
    expect(mockGetOrCreateSingleton).toHaveBeenCalledWith(MockModel);
    expect(result).toBe(existing);
  });

  // 2. Helper errors (e.g. ambiguous unkeyed documents) propagate untouched
  it('should propagate errors from getOrCreateSingleton', async () => {
    mockGetOrCreateSingleton.mockRejectedValue(new Error('ambiguous singleton'));

    await expect(getSiteSettings()).rejects.toThrow('ambiguous singleton');
  });
});

describe('SiteSettings — updateSiteSettings', () => {
  // 1. Top-level whitelisted fields are written against the singleton's _id
  it('should update whitelisted top-level fields on the existing singleton', async () => {
    mockGetOrCreateSingleton.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue({ ...existing, siteName: 'New' });

    const result = await updateSiteSettings(mockReq({
      siteName: 'New', siteNameFull: 'New Full', tagline: 't', description: 'd', siteUrl: 'https://x', workingHours: '9-5',
      mapsEmbedId: 'map', aboutTitle: 'About', aboutDescription: 'ad', aboutFeatures: ['a', 'b'], warrantyPolicy: 'wp',
      contactPhone: '+2010', contactEmail: 'a@b.co', whatsappNumber: '201234567890',
    }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: SETTINGS_ID }, {
      siteName: 'New', siteNameFull: 'New Full', tagline: 't', description: 'd', siteUrl: 'https://x', workingHours: '9-5',
      mapsEmbedId: 'map', aboutTitle: 'About', aboutDescription: 'ad', aboutFeatures: ['a', 'b'], warrantyPolicy: 'wp',
      contactPhone: '+2010', contactEmail: 'a@b.co', whatsappNumber: '201234567890',
    });
    expect(result).toEqual({ ...existing, siteName: 'New' });
  });

  // 2. Dotted nested keys are whitelisted and passed through as-is for Mongo dot-notation updates
  it('should pass whitelisted dotted keys through unchanged', async () => {
    mockGetOrCreateSingleton.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateSiteSettings(mockReq({
      'logo.alt': 'Logo', 'logo.width': 120, 'logo.height': 40,
      'rating.score': '4.9', 'rating.reviewCount': 120,
      'pageCopy.servicesIntro': 'si', 'pageCopy.branchesHeading': 'bh', 'pageCopy.branchesSub': 'bs',
      'pageCopy.shopIntro': 'sh', 'pageCopy.photoGalleryCta': 'cta',
      'stats.experienceYears': 10, 'stats.clientsCount': 500, 'stats.teamMembersCount': 12,
      'socialLinks.facebook': 'fb', 'socialLinks.instagram': 'ig', 'socialLinks.tiktok': 'tt',
      'socialLinks.snapchat': 'sc', 'socialLinks.youtube': 'yt', 'socialLinks.twitter': 'tw',
    }));

    expect(mockCrud.findOneAndUpdate.mock.calls[0][1]).toEqual({
      'logo.alt': 'Logo', 'logo.width': 120, 'logo.height': 40,
      'rating.score': '4.9', 'rating.reviewCount': 120,
      'pageCopy.servicesIntro': 'si', 'pageCopy.branchesHeading': 'bh', 'pageCopy.branchesSub': 'bs',
      'pageCopy.shopIntro': 'sh', 'pageCopy.photoGalleryCta': 'cta',
      'stats.experienceYears': 10, 'stats.clientsCount': 500, 'stats.teamMembersCount': 12,
      'socialLinks.facebook': 'fb', 'socialLinks.instagram': 'ig', 'socialLinks.tiktok': 'tt',
      'socialLinks.snapchat': 'sc', 'socialLinks.youtube': 'yt', 'socialLinks.twitter': 'tw',
    });
  });

  // 3. Media/identity fields are never writable from the body (mass-assignment protection)
  it('should drop aboutImage/aboutImagePublicId/logo.url/logo.publicId/singletonKey/_id from the body', async () => {
    mockGetOrCreateSingleton.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateSiteSettings(mockReq({
      siteName: 'ok',
      aboutImage: 'https://evil', aboutImagePublicId: 'hack', 'logo.url': 'https://evil', 'logo.publicId': 'hack',
      singletonKey: 'other', _id: 'other-id', createdAt: 'x',
    }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: SETTINGS_ID }, { siteName: 'ok' });
  });

  // 4. Nested objects are NOT accepted — only the dotted form is whitelisted
  it('should ignore nested objects such as { logo: { alt } } (dotted-key contract)', async () => {
    mockGetOrCreateSingleton.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateSiteSettings(mockReq({ logo: { alt: 'nested' }, stats: { experienceYears: 3 } }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: SETTINGS_ID }, {});
  });

  // 5. Explicit falsy/empty values (clearing a field) are persisted
  it('should persist empty strings and zero so fields can be cleared', async () => {
    mockGetOrCreateSingleton.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateSiteSettings(mockReq({ contactEmail: '', 'stats.clientsCount': 0, 'socialLinks.twitter': '' }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: SETTINGS_ID }, {
      contactEmail: '', 'stats.clientsCount': 0, 'socialLinks.twitter': '',
    });
  });

  // 6. aboutImage slot: url/publicId are mapped and no delete happens when nothing was stored before
  it('should map the aboutImage slot and skip Cloudinary deletion when there was no previous image', async () => {
    mockGetOrCreateSingleton.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const uploadedSlots = { aboutImage: { url: 'https://cdn/about.png', publicId: 'settings/about', width: 800, height: 600 } };

    await updateSiteSettings(mockReq({}, { uploadedSlots }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: SETTINGS_ID }, {
      aboutImage: 'https://cdn/about.png', aboutImagePublicId: 'settings/about',
    });
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 7. aboutImage slot replaces a previous image: the old asset is deleted with the exact context
  it('should delete the previous about image when the aboutImage slot is replaced', async () => {
    mockGetOrCreateSingleton.mockResolvedValue({ ...existing, aboutImage: 'https://cdn/old.png', aboutImagePublicId: 'settings/old-about' });
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const uploadedSlots = { aboutImage: { url: 'https://cdn/new.png', publicId: 'settings/new-about' } };

    await updateSiteSettings(mockReq({ aboutTitle: 'T' }, { uploadedSlots }));

    expect(mockSafeDelete).toHaveBeenCalledTimes(1);
    expect(mockSafeDelete).toHaveBeenCalledWith('settings/old-about', {
      resource: 'SiteSetting', id: SETTINGS_ID, reason: 'aboutImage_replaced_on_update',
    });
    expect(mockCrud.findOneAndUpdate.mock.calls[0][1]).toEqual({
      aboutTitle: 'T', aboutImage: 'https://cdn/new.png', aboutImagePublicId: 'settings/new-about',
    });
  });

  // 8. logo slot: url/publicId plus width/height (numeric only) are written to dotted logo paths
  it('should map the logo slot to logo.url/publicId/width/height and delete the previous logo', async () => {
    mockGetOrCreateSingleton.mockResolvedValue({ ...existing, logo: { url: 'https://cdn/old-logo.png', publicId: 'settings/old-logo' } });
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const uploadedSlots = { logo: { url: 'https://cdn/logo.png', publicId: 'settings/logo', width: 240, height: 80 } };

    await updateSiteSettings(mockReq({}, { uploadedSlots }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: SETTINGS_ID }, {
      'logo.url': 'https://cdn/logo.png', 'logo.publicId': 'settings/logo', 'logo.width': 240, 'logo.height': 80,
    });
    expect(mockSafeDelete).toHaveBeenCalledWith('settings/old-logo', {
      resource: 'SiteSetting', id: SETTINGS_ID, reason: 'logo_replaced_on_update',
    });
  });

  // 9. Missing/non-numeric dimensions must not overwrite stored logo width/height
  it('should not write logo.width/height when the upload result lacks numeric dimensions', async () => {
    mockGetOrCreateSingleton.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const uploadedSlots = { logo: { url: 'https://cdn/logo.svg', publicId: 'settings/logo', width: undefined, height: '80' } };

    await updateSiteSettings(mockReq({}, { uploadedSlots }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: SETTINGS_ID }, {
      'logo.url': 'https://cdn/logo.svg', 'logo.publicId': 'settings/logo',
    });
  });

  // 10. A logo upload on a document with no `logo` sub-object must not crash and must not delete anything
  it('should tolerate a missing logo sub-object on the existing document', async () => {
    mockGetOrCreateSingleton.mockResolvedValue({ _id: SETTINGS_ID });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await updateSiteSettings(mockReq({}, { uploadedSlots: { logo: { url: 'u', publicId: 'p' } } }));

    expect(mockSafeDelete).not.toHaveBeenCalled();
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: SETTINGS_ID }, { 'logo.url': 'u', 'logo.publicId': 'p' });
  });

  // 11. Both slots in one request are handled independently
  it('should handle aboutImage and logo slots in the same request', async () => {
    mockGetOrCreateSingleton.mockResolvedValue({
      ...existing, aboutImagePublicId: 'settings/old-about', logo: { publicId: 'settings/old-logo' },
    });
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const uploadedSlots = {
      aboutImage: { url: 'https://cdn/a.png', publicId: 'settings/a' },
      logo: { url: 'https://cdn/l.png', publicId: 'settings/l', width: 10, height: 5 },
    };

    await updateSiteSettings(mockReq({}, { uploadedSlots }));

    expect(mockCrud.findOneAndUpdate.mock.calls[0][1]).toEqual({
      aboutImage: 'https://cdn/a.png', aboutImagePublicId: 'settings/a',
      'logo.url': 'https://cdn/l.png', 'logo.publicId': 'settings/l', 'logo.width': 10, 'logo.height': 5,
    });
    expect(mockSafeDelete).toHaveBeenCalledTimes(2);
    expect(mockSafeDelete).toHaveBeenCalledWith('settings/old-about', expect.objectContaining({ reason: 'aboutImage_replaced_on_update' }));
    expect(mockSafeDelete).toHaveBeenCalledWith('settings/old-logo', expect.objectContaining({ reason: 'logo_replaced_on_update' }));
  });

  // 12. Unknown slot names are ignored; no uploadedSlots at all is fine
  it('should ignore unknown slots and work without uploadedSlots', async () => {
    mockGetOrCreateSingleton.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateSiteSettings(mockReq({ siteName: 'a' }, { uploadedSlots: { heroImage: { url: 'u', publicId: 'p' } } }));
    await updateSiteSettings(mockReq({ siteName: 'b' }));

    expect(mockCrud.findOneAndUpdate.mock.calls[0][1]).toEqual({ siteName: 'a' });
    expect(mockCrud.findOneAndUpdate.mock.calls[1][1]).toEqual({ siteName: 'b' });
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 13. A singleton lookup failure aborts before any write
  it('should propagate getOrCreateSingleton errors and not write', async () => {
    mockGetOrCreateSingleton.mockRejectedValue(new Error('db down'));

    await expect(updateSiteSettings(mockReq({ siteName: 'x' }))).rejects.toThrow('db down');
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  // 14. An UPDATE audit entry is written for the acting admin with the singleton id
  it('should log an UPDATE audit entry with the actor and settings id', async () => {
    mockGetOrCreateSingleton.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const req = mockReq({ siteName: 'x' });

    await updateSiteSettings(req);

    expect(mockActorFromReq).toHaveBeenCalledWith(req);
    expect(mockLogAudit).toHaveBeenCalledWith({
      userId: 'admin-id', ip: '127.0.0.1', action: 'UPDATE', resource: 'SiteSetting', details: { id: SETTINGS_ID },
    });
  });
});
