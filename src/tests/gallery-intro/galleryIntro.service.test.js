import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
// The factory runs at import time and jest's clearMocks would wipe a jest.fn's calls
// before the first test, so the config is captured in a plain array instead.
const factoryCalls = [];
const mockGet = jest.fn();
const mockUpdate = jest.fn();

jest.unstable_mockModule('../../services/singleton.service.js', () => ({
  singletonService: (name, config) => {
    factoryCalls.push([name, config]);
    return { get: mockGet, update: mockUpdate };
  },
}));

const { getGalleryIntro, updateGalleryIntro } = await import('../../services/galleryIntro.service.js');

const DOC_ID = '64a1f0c2e4b0a1b2c3d4e5f6';

describe('GalleryIntro — factory wiring', () => {
  // 1. The singleton is built once for the GalleryIntro model with dotted text paths only
  it('should build the GalleryIntro singleton with the dotted text whitelist', () => {
    expect(factoryCalls).toHaveLength(1);
    const [name, config] = factoryCalls[0];
    expect(name).toBe('GalleryIntro');
    expect(config.updatableFields).toEqual([
      'video.heading', 'video.description',
      'photo.heading', 'photo.description',
    ]);
  });

  // 2. Text-only section: no image slots are declared at all
  it('should declare no imageSlots', () => {
    const [, config] = factoryCalls[0];
    expect(config).toEqual({
      updatableFields: ['video.heading', 'video.description', 'photo.heading', 'photo.description'],
    });
    expect(config).not.toHaveProperty('imageSlots');
    expect(config.updatableFields).not.toContain('singletonKey');
  });
});

describe('GalleryIntro — getGalleryIntro / updateGalleryIntro', () => {
  // 1. Read is the factory's get, untouched
  it('should expose the singleton get as-is', async () => {
    const doc = { _id: DOC_ID, video: { heading: 'Videos' } };
    mockGet.mockResolvedValue(doc);

    expect(getGalleryIntro).toBe(mockGet);
    await expect(getGalleryIntro()).resolves.toBe(doc);
  });

  // 2. Write is the factory's update, untouched
  it('should expose the singleton update as-is', async () => {
    const doc = { _id: DOC_ID, photo: { heading: 'New' } };
    mockUpdate.mockResolvedValue(doc);
    const req = { body: { 'photo.heading': 'New' } };

    expect(updateGalleryIntro).toBe(mockUpdate);
    await expect(updateGalleryIntro(req)).resolves.toBe(doc);
    expect(mockUpdate).toHaveBeenCalledWith(req);
  });
});
