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

const { getPromo, updatePromo, getActivePromo } = await import('../../services/promo.service.js');

const DOC_ID = '64a1f0c2e4b0a1b2c3d4e5f6';

describe('Promo — factory wiring', () => {
  // 1. The singleton is built once for the Promo model with the exact whitelist
  it('should build the Promo singleton with the editable whitelist', () => {
    expect(factoryCalls).toHaveLength(1);
    const [name, config] = factoryCalls[0];
    expect(name).toBe('Promo');
    expect(config.updatableFields).toEqual(['alt', 'width', 'height', 'whatsappText', 'delayMs', 'isActive']);
  });

  // 2. image/imagePublicId are never body-editable — only via the upload slot
  it('should map the image slot to image/imagePublicId with width/height and keep them out of the whitelist', () => {
    const [, config] = factoryCalls[0];
    expect(config.imageSlots).toEqual({
      image: { urlField: 'image', publicIdField: 'imagePublicId', widthField: 'width', heightField: 'height' },
    });
    expect(config.updatableFields).not.toContain('image');
    expect(config.updatableFields).not.toContain('imagePublicId');
    expect(config.updatableFields).not.toContain('singletonKey');
  });
});

describe('Promo — getPromo / updatePromo', () => {
  // 1. Admin read and write are the factory functions, untouched
  it('should expose the singleton get and update as-is', async () => {
    const doc = { _id: DOC_ID, isActive: false };
    mockGet.mockResolvedValue(doc);
    mockUpdate.mockResolvedValue(doc);
    const req = { body: { alt: 'x' } };

    expect(getPromo).toBe(mockGet);
    expect(updatePromo).toBe(mockUpdate);
    await expect(getPromo()).resolves.toBe(doc);
    await expect(updatePromo(req)).resolves.toBe(doc);
    expect(mockUpdate).toHaveBeenCalledWith(req);
  });
});

describe('Promo — getActivePromo', () => {
  // 1. Active campaign with artwork is served
  it('should return the promo when active and it has an image', async () => {
    const promo = { _id: DOC_ID, isActive: true, image: 'https://cdn/p.png' };
    mockGet.mockResolvedValue(promo);

    const result = await getActivePromo();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(result).toBe(promo);
  });

  // 2. Retired campaign → null (artwork not leaked to the public)
  it('should return null when the campaign is inactive', async () => {
    mockGet.mockResolvedValue({ _id: DOC_ID, isActive: false, image: 'https://cdn/p.png' });

    await expect(getActivePromo()).resolves.toBeNull();
  });

  // 3. Active but no artwork → null so no empty overlay renders
  it('should return null when active but the image is missing', async () => {
    mockGet.mockResolvedValueOnce({ _id: DOC_ID, isActive: true, image: null });
    mockGet.mockResolvedValueOnce({ _id: DOC_ID, isActive: true });

    await expect(getActivePromo()).resolves.toBeNull();
    await expect(getActivePromo()).resolves.toBeNull();
  });

  // 4. Defensive: a missing document is also null
  it('should return null when the singleton read yields nothing', async () => {
    mockGet.mockResolvedValue(null);

    await expect(getActivePromo()).resolves.toBeNull();
  });
});
