import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockExists = jest.fn();
const mockModel = jest.fn(() => ({ exists: mockExists }));

jest.unstable_mockModule('mongoose', () => ({ default: { model: mockModel } }));

const { slugifyFunction, resolveSlug } = await import('../../utils/buildSlugify.js');

const DOC_ID = '64a1f0c2e4b0a1b2c3d4e5f6';

describe('Utils — slugifyFunction', () => {
  // 1. Basic: trim, lowercase, spaces → hyphens, punctuation stripped
  it('should lowercase, trim and hyphenate a plain title', () => {
    expect(slugifyFunction('  Hello World!! ')).toBe('hello-world');
  });

  // 2. Arabic letters are preserved and Arabic punctuation acts as a separator
  it('should keep Arabic letters and treat Arabic comma as a separator', () => {
    expect(slugifyFunction('خدمات السيارات، الرياض')).toBe('خدمات-السيارات-الرياض');
  });

  // 3. Underscores, dots and repeated separators collapse to a single hyphen
  it('should collapse runs of separators into one hyphen', () => {
    expect(slugifyFunction('a__b..c')).toBe('a-b-c');
    expect(slugifyFunction('a  -  b')).toBe('a-b');
  });

  // 4. Leading and trailing hyphens are removed
  it('should strip leading and trailing hyphens', () => {
    expect(slugifyFunction('--a--')).toBe('a');
  });

  // 5. Input made only of punctuation collapses to an empty string
  it('should return an empty string for punctuation-only input', () => {
    expect(slugifyFunction('!!!')).toBe('');
    expect(slugifyFunction('   ')).toBe('');
  });

  // 6. null / undefined are treated as empty
  it('should treat null and undefined as empty input', () => {
    expect(slugifyFunction(null)).toBe('');
    expect(slugifyFunction(undefined)).toBe('');
  });

  // 7. Accented Latin letters are letters and survive; emoji are not and are dropped
  it('should keep accented letters and drop emoji', () => {
    expect(slugifyFunction('Café Ünïcode')).toBe('café-ünïcode');
    expect(slugifyFunction('a😀b')).toBe('ab');
  });

  // 8. Non-string input is stringified
  it('should stringify numeric input', () => {
    expect(slugifyFunction(123)).toBe('123');
  });

  // 9. Deterministic — same input, same output
  it('should be deterministic', () => {
    expect(slugifyFunction('Ceramic Coating')).toBe(slugifyFunction('Ceramic Coating'));
  });
});

describe('Utils — resolveSlug', () => {
  // 1. Admin-supplied slug wins over the fallback and is returned when free
  it('should prefer the desired slug and return it when no collision exists', async () => {
    mockExists.mockResolvedValue(null);

    const slug = await resolveSlug('Product', 'Custom Slug', 'Ignored Title');

    expect(mockModel).toHaveBeenCalledWith('Product');
    expect(mockExists).toHaveBeenCalledTimes(1);
    expect(mockExists).toHaveBeenCalledWith({ slug: 'custom-slug' });
    expect(slug).toBe('custom-slug');
  });

  // 2. Empty desired slug falls back to the title
  it('should derive from the fallback when desired is empty or undefined', async () => {
    mockExists.mockResolvedValue(null);

    expect(await resolveSlug('Product', '', 'Ceramic Coating')).toBe('ceramic-coating');
    expect(await resolveSlug('Product', undefined, 'Ceramic Coating')).toBe('ceramic-coating');
  });

  // 3. First collision → -2 suffix
  it('should append -2 when the base slug is taken', async () => {
    mockExists.mockResolvedValueOnce({ _id: 'x' }).mockResolvedValueOnce(null);

    const slug = await resolveSlug('Product', undefined, 'Wax');

    expect(slug).toBe('wax-2');
    expect(mockExists.mock.calls.map((c) => c[0])).toEqual([{ slug: 'wax' }, { slug: 'wax-2' }]);
  });

  // 4. Successive collisions → -3
  it('should append -3 when both the base and -2 are taken', async () => {
    mockExists.mockResolvedValueOnce({ _id: 'a' }).mockResolvedValueOnce({ _id: 'b' }).mockResolvedValueOnce(null);

    const slug = await resolveSlug('Product', undefined, 'Wax');

    expect(slug).toBe('wax-3');
    expect(mockExists).toHaveBeenCalledTimes(3);
  });

  // 5. excludeId is added as a $ne so a document does not collide with itself
  it('should exclude the given document id from the uniqueness query', async () => {
    mockExists.mockResolvedValue(null);

    await resolveSlug('Product', 'wax', 'Wax', DOC_ID);

    expect(mockExists).toHaveBeenCalledWith({ slug: 'wax', _id: { $ne: DOC_ID } });
  });

  // 6. excludeId is also applied to suffixed candidates
  it('should keep the $ne exclusion on collision candidates', async () => {
    mockExists.mockResolvedValueOnce({ _id: 'x' }).mockResolvedValueOnce(null);

    const slug = await resolveSlug('Product', 'wax', 'Wax', DOC_ID);

    expect(slug).toBe('wax-2');
    expect(mockExists).toHaveBeenLastCalledWith({ slug: 'wax-2', _id: { $ne: DOC_ID } });
  });

  // 7. Empty/punctuation-only input yields item-<base36 timestamp> and never hits the DB
  it('should return item-<timestamp> without querying when nothing slugifiable is given', async () => {
    const slug = await resolveSlug('Product', '', '!!!');

    expect(slug).toMatch(/^item-[0-9a-z]+$/);
    expect(mockModel).not.toHaveBeenCalled();
    expect(mockExists).not.toHaveBeenCalled();
  });

  // 8. After 98 taken suffixes a timestamp tail is used instead
  it('should fall back to a timestamp suffix when -2..-99 are all taken', async () => {
    mockExists.mockResolvedValue({ _id: 'taken' });

    const slug = await resolveSlug('Product', undefined, 'Wax');

    expect(slug).toMatch(/^wax-[0-9a-z]+$/);
    expect(slug).not.toMatch(/^wax-\d{1,2}$/);
    // base + candidates 2..99
    expect(mockExists).toHaveBeenCalledTimes(1 + 98);
  });

  // 9. The model is looked up by the given name
  it('should resolve the mongoose model by name', async () => {
    mockExists.mockResolvedValue(null);

    await resolveSlug('WarrantyGroup', undefined, 'Gold');

    expect(mockModel).toHaveBeenCalledWith('WarrantyGroup');
  });
});
