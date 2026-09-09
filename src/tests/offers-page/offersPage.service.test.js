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

const { getOffersPage, updateOffersPage } = await import('../../services/offersPage.service.js');

const DOC_ID = '64a1f0c2e4b0a1b2c3d4e5f6';

describe('OffersPage — factory wiring', () => {
  // 1. The singleton is built once for the OffersPage model with the exact whitelist
  it('should build the OffersPage singleton with the editable whitelist', () => {
    expect(factoryCalls).toHaveLength(1);
    const [name, config] = factoryCalls[0];
    expect(name).toBe('OffersPage');
    expect(config.updatableFields).toEqual(['bannerAlt', 'intro', 'formHeading', 'formSubheading']);
  });

  // 2. banner/bannerPublicId come only from the upload slot
  it('should map the banner slot and keep banner paths out of the whitelist', () => {
    const [, config] = factoryCalls[0];
    expect(config.imageSlots).toEqual({ banner: { urlField: 'banner', publicIdField: 'bannerPublicId' } });
    expect(config.updatableFields).not.toContain('banner');
    expect(config.updatableFields).not.toContain('bannerPublicId');
    expect(config.updatableFields).not.toContain('singletonKey');
  });
});

describe('OffersPage — getOffersPage / updateOffersPage', () => {
  // 1. Read is the factory's get, untouched
  it('should expose the singleton get as-is', async () => {
    const doc = { _id: DOC_ID, intro: 'Offers' };
    mockGet.mockResolvedValue(doc);

    expect(getOffersPage).toBe(mockGet);
    await expect(getOffersPage()).resolves.toBe(doc);
  });

  // 2. Write is the factory's update, untouched
  it('should expose the singleton update as-is', async () => {
    const doc = { _id: DOC_ID, intro: 'New' };
    mockUpdate.mockResolvedValue(doc);
    const req = { body: { intro: 'New' } };

    expect(updateOffersPage).toBe(mockUpdate);
    await expect(updateOffersPage(req)).resolves.toBe(doc);
    expect(mockUpdate).toHaveBeenCalledWith(req);
  });
});
