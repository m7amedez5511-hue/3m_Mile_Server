import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
// The factory runs at import time and jest's clearMocks would wipe a jest.fn's calls
// before the first test, so the config is captured in a plain array instead.
const factoryCalls = [];
const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockSafeDelete = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('../../services/singleton.service.js', () => ({
  singletonService: (name, config) => {
    factoryCalls.push([name, config]);
    return { get: mockGet, update: mockUpdate };
  },
}));
jest.unstable_mockModule('../../utils/softDeleteImage.js', () => ({ safeDeleteCloudinaryImage: mockSafeDelete }));

const { getHomeContent, updateHomeContent } = await import('../../services/homeContent.service.js');

const DOC_ID = '64a1f0c2e4b0a1b2c3d4e5f6';
const mockReq = (body = {}, extra = {}) => ({ body, ip: '127.0.0.1', user: { _id: 'admin-id' }, ...extra });

const storedTrust = [
  { head: 'H0', sub: 'S0', icon: '', image: { url: 'https://cdn/t0.png', publicId: 'trust0', alt: 'alt0' } },
  { head: 'H1', sub: 'S1', icon: '', image: { url: 'https://cdn/t1.png', publicId: 'trust1', alt: 'alt1' } },
  { head: 'H2', sub: 'S2', icon: 'shield', image: { url: null, publicId: null, alt: '' } },
];
const existing = { _id: DOC_ID, trust: storedTrust };

describe('HomeContent — factory wiring', () => {
  // 1. The singleton factory is configured for the HomeContent model
  it('should build the HomeContent singleton once with the whitelist and image slots', () => {
    expect(factoryCalls).toHaveLength(1);
    const [name, config] = factoryCalls[0];
    expect(name).toBe('HomeContent');
    expect(config.updatableFields).toEqual(expect.arrayContaining([
      'hero.ctaLabel', 'hero.ctaText', 'hero.width', 'hero.height', 'trust', 'stats',
      'whyUs.points', 'heroTiles.gallery.actions', 'sections.ctaLabel',
    ]));
  });

  // 2. Media publicId paths are never in the text whitelist
  it('should not whitelist any url/publicId path or the singleton key', () => {
    const [, config] = factoryCalls[0];
    for (const field of config.updatableFields) {
      expect(field).not.toMatch(/publicId|\.url$|\.video$|\.poster$|singletonKey|^_id$/);
    }
  });

  // 3. The hero video slot carries the video resourceType and dimension paths
  it('should declare the hero video slot as a video with width/height fields', () => {
    const [, config] = factoryCalls[0];
    expect(config.imageSlots.heroVideo).toEqual({
      urlField: 'hero.video', publicIdField: 'hero.videoPublicId', resourceType: 'video',
      widthField: 'hero.width', heightField: 'hero.height',
    });
    expect(config.imageSlots.heroPoster).toEqual({ urlField: 'hero.poster', publicIdField: 'hero.posterPublicId' });
    expect(config.imageSlots.whyUsImage).toEqual({ urlField: 'whyUs.image.url', publicIdField: 'whyUs.image.publicId' });
    expect(config.imageSlots.branchesTileImage).toEqual({ urlField: 'heroTiles.branches.image.url', publicIdField: 'heroTiles.branches.image.publicId' });
    expect(config.imageSlots.galleryTileImage).toEqual({ urlField: 'heroTiles.gallery.image.url', publicIdField: 'heroTiles.gallery.image.publicId' });
  });

  // 4. Trust badges are resolved by hand, never as a mapped slot
  it('should not declare trust images as mapped slots', () => {
    const [, config] = factoryCalls[0];
    expect(Object.keys(config.imageSlots)).toEqual(['heroVideo', 'heroPoster', 'whyUsImage', 'branchesTileImage', 'galleryTileImage']);
  });
});

describe('HomeContent — getHomeContent', () => {
  // 1. Read is the factory's get, untouched
  it('should be the singleton get function', async () => {
    mockGet.mockResolvedValue(existing);

    const result = await getHomeContent();

    expect(getHomeContent).toBe(mockGet);
    expect(result).toBe(existing);
  });
});

describe('HomeContent — updateHomeContent', () => {
  // 1. A body without trust and no trust uploads is delegated straight to the factory
  it('should delegate directly without reading the document when trust is untouched', async () => {
    mockUpdate.mockResolvedValue({ _id: DOC_ID });
    const req = mockReq({ 'hero.ctaLabel': 'Book' });

    const result = await updateHomeContent(req);

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(req);
    expect(req.body).toEqual({ 'hero.ctaLabel': 'Book' });
    expect(mockSafeDelete).not.toHaveBeenCalled();
    expect(result).toEqual({ _id: DOC_ID });
  });

  // 2. A text-only trust edit keeps every stored image and lets new alt text win
  it('should merge typed trust text over stored images, with item.alt overriding stored alt', async () => {
    mockGet.mockResolvedValue(existing);
    mockUpdate.mockResolvedValue(existing);
    const req = mockReq({
      trust: [
        { head: 'New0', sub: 'NewSub0', icon: '', alt: 'newalt0' },
        { head: 'New1' },
        { icon: 'star' },
      ],
    });

    await updateHomeContent(req);

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(req.body.trust).toEqual([
      { head: 'New0', sub: 'NewSub0', icon: '', image: { url: 'https://cdn/t0.png', publicId: 'trust0', alt: 'newalt0' } },
      { head: 'New1', sub: '', icon: '', image: { url: 'https://cdn/t1.png', publicId: 'trust1', alt: 'alt1' } },
      { head: '', sub: '', icon: 'star', image: { url: null, publicId: null, alt: '' } },
    ]);
    expect(mockUpdate).toHaveBeenCalledWith(req);
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 3. An uploaded badge replaces the stored image and the old asset is deleted
  it('should apply an uploaded trust image and delete the replaced asset', async () => {
    mockGet.mockResolvedValue(existing);
    mockUpdate.mockResolvedValue(existing);
    const req = mockReq(
      { trust: [{ head: 'A' }, { head: 'B', alt: 'fresh' }, { head: 'C' }] },
      { uploadedSlots: { trustImage1: { url: 'https://cdn/new1.png', publicId: 'new1' } } },
    );

    await updateHomeContent(req);

    expect(req.body.trust[1]).toEqual({ head: 'B', sub: '', icon: '', image: { url: 'https://cdn/new1.png', publicId: 'new1', alt: 'fresh' } });
    expect(req.body.trust[0].image).toEqual({ url: 'https://cdn/t0.png', publicId: 'trust0', alt: 'alt0' });
    expect(mockSafeDelete).toHaveBeenCalledTimes(1);
    expect(mockSafeDelete).toHaveBeenCalledWith('trust1', { resource: 'HomeContent', id: DOC_ID, reason: 'trust_1_replaced_on_update' });
  });

  // 4. Uploading over a badge that had no image deletes nothing
  it('should not call Cloudinary when the replaced slot had no publicId', async () => {
    mockGet.mockResolvedValue(existing);
    mockUpdate.mockResolvedValue(existing);
    const req = mockReq(
      { trust: [{ head: 'A' }, { head: 'B' }, { head: 'C' }] },
      { uploadedSlots: { trustImage2: { url: 'https://cdn/new2.png', publicId: 'new2' } } },
    );

    await updateHomeContent(req);

    expect(req.body.trust[2].image).toEqual({ url: 'https://cdn/new2.png', publicId: 'new2', alt: '' });
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 5. Uploaded badge falls back to the stored alt when the item carries none
  it('should keep the stored alt on an uploaded badge when no alt was typed', async () => {
    mockGet.mockResolvedValue(existing);
    mockUpdate.mockResolvedValue(existing);
    const req = mockReq(
      { trust: [{ head: 'A' }, { head: 'B' }, { head: 'C' }] },
      { uploadedSlots: { trustImage0: { url: 'https://cdn/new0.png', publicId: 'new0' } } },
    );

    await updateHomeContent(req);

    expect(req.body.trust[0].image).toEqual({ url: 'https://cdn/new0.png', publicId: 'new0', alt: 'alt0' });
  });

  // 6. Uploads without a trust body use the stored array as the text source
  it('should resolve trust from the stored array when only uploads are sent', async () => {
    mockGet.mockResolvedValue(existing);
    mockUpdate.mockResolvedValue(existing);
    const req = mockReq({}, { uploadedSlots: { trustImage0: { url: 'https://cdn/new0.png', publicId: 'new0' } } });

    await updateHomeContent(req);

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(req.body.trust).toEqual([
      { head: 'H0', sub: 'S0', icon: '', image: { url: 'https://cdn/new0.png', publicId: 'new0', alt: 'alt0' } },
      { head: 'H1', sub: 'S1', icon: '', image: { url: 'https://cdn/t1.png', publicId: 'trust1', alt: 'alt1' } },
      { head: 'H2', sub: 'S2', icon: 'shield', image: { url: null, publicId: null, alt: '' } },
    ]);
    expect(mockSafeDelete).toHaveBeenCalledWith('trust0', { resource: 'HomeContent', id: DOC_ID, reason: 'trust_0_replaced_on_update' });
  });

  // 7. Current behaviour: uploads-only on a document with no stored trust produce an empty array
  //    (the upload is silently dropped because there is no text row to attach it to).
  it('should write an empty trust array when uploads arrive but nothing is stored and no trust body was sent', async () => {
    mockGet.mockResolvedValue({ _id: DOC_ID, trust: [] });
    mockUpdate.mockResolvedValue({ _id: DOC_ID });
    const req = mockReq({}, { uploadedSlots: { trustImage0: { url: 'https://cdn/new0.png', publicId: 'new0' } } });

    await updateHomeContent(req);

    expect(req.body.trust).toEqual([]);
    expect(mockSafeDelete).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(req);
  });

  // 8. A document that has never had trust set is treated as an empty array
  it('should tolerate a document without a trust field', async () => {
    mockGet.mockResolvedValue({ _id: DOC_ID });
    mockUpdate.mockResolvedValue({ _id: DOC_ID });
    const req = mockReq({ trust: [{ head: 'A' }, { head: 'B' }, { head: 'C' }] });

    await updateHomeContent(req);

    expect(req.body.trust).toEqual([
      { head: 'A', sub: '', icon: '', image: { alt: '' } },
      { head: 'B', sub: '', icon: '', image: { alt: '' } },
      { head: 'C', sub: '', icon: '', image: { alt: '' } },
    ]);
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 9. Multiple uploads in one request each delete their own replaced asset
  it('should delete every replaced badge asset when several are uploaded at once', async () => {
    mockGet.mockResolvedValue(existing);
    mockUpdate.mockResolvedValue(existing);
    const req = mockReq(
      { trust: [{ head: 'A' }, { head: 'B' }, { head: 'C' }] },
      {
        uploadedSlots: {
          trustImage0: { url: 'https://cdn/n0.png', publicId: 'n0' },
          trustImage1: { url: 'https://cdn/n1.png', publicId: 'n1' },
        },
      },
    );

    await updateHomeContent(req);

    expect(mockSafeDelete).toHaveBeenCalledTimes(2);
    expect(mockSafeDelete).toHaveBeenCalledWith('trust0', { resource: 'HomeContent', id: DOC_ID, reason: 'trust_0_replaced_on_update' });
    expect(mockSafeDelete).toHaveBeenCalledWith('trust1', { resource: 'HomeContent', id: DOC_ID, reason: 'trust_1_replaced_on_update' });
  });

  // 10. Other body fields travel untouched alongside the resolved trust array
  it('should leave the rest of the body intact and return the factory result', async () => {
    mockGet.mockResolvedValue(existing);
    const updated = { _id: DOC_ID, 'hero.ctaLabel': 'Go' };
    mockUpdate.mockResolvedValue(updated);
    const req = mockReq({ 'hero.ctaLabel': 'Go', trust: [{ head: 'A' }, { head: 'B' }, { head: 'C' }] });

    const result = await updateHomeContent(req);

    expect(req.body['hero.ctaLabel']).toBe('Go');
    expect(mockUpdate).toHaveBeenCalledWith(req);
    expect(result).toBe(updated);
  });
});
