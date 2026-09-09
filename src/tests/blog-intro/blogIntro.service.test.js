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

const { getBlogIntro, updateBlogIntro } = await import('../../services/blogIntro.service.js');

const DOC_ID = '64a1f0c2e4b0a1b2c3d4e5f6';

describe('BlogIntro — factory wiring', () => {
  // 1. The singleton is built once for the BlogIntro model with the exact whitelist
  it('should build the BlogIntro singleton with the editable whitelist', () => {
    expect(factoryCalls).toHaveLength(1);
    const [name, config] = factoryCalls[0];
    expect(name).toBe('BlogIntro');
    expect(config.updatableFields).toEqual(['heading', 'description', 'imageAlt']);
  });

  // 2. image/imagePublicId come only from the upload slot
  it('should map the image slot and keep image paths out of the whitelist', () => {
    const [, config] = factoryCalls[0];
    expect(config.imageSlots).toEqual({ image: { urlField: 'image', publicIdField: 'imagePublicId' } });
    expect(config.updatableFields).not.toContain('image');
    expect(config.updatableFields).not.toContain('imagePublicId');
    expect(config.updatableFields).not.toContain('singletonKey');
  });
});

describe('BlogIntro — getBlogIntro / updateBlogIntro', () => {
  // 1. Read is the factory's get, untouched
  it('should expose the singleton get as-is', async () => {
    const doc = { _id: DOC_ID, heading: 'Blog' };
    mockGet.mockResolvedValue(doc);

    expect(getBlogIntro).toBe(mockGet);
    await expect(getBlogIntro()).resolves.toBe(doc);
  });

  // 2. Write is the factory's update, untouched
  it('should expose the singleton update as-is', async () => {
    const doc = { _id: DOC_ID, heading: 'New' };
    mockUpdate.mockResolvedValue(doc);
    const req = { body: { heading: 'New' } };

    expect(updateBlogIntro).toBe(mockUpdate);
    await expect(updateBlogIntro(req)).resolves.toBe(doc);
    expect(mockUpdate).toHaveBeenCalledWith(req);
  });
});
