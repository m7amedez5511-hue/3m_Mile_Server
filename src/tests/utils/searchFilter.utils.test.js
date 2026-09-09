// Pure util — no mocks required.
const { buildSearchRegex } = await import('../../utils/searchFilter.js');

describe('Utils — buildSearchRegex', () => {
  // 1. Plain text becomes a case-insensitive literal regex
  it('should return a case-insensitive regex for plain text', () => {
    expect(buildSearchRegex('wax')).toEqual({ $regex: 'wax', $options: 'i' });
  });

  // 2. Repeated query keys arrive as an array; only the first is used
  it('should use the first element when given an array', () => {
    expect(buildSearchRegex(['first', 'second'])).toEqual({ $regex: 'first', $options: 'i' });
  });

  // 3. Non-string input (or an array whose first element is not a string) is ignored
  it('should return undefined for non-string input', () => {
    expect(buildSearchRegex(undefined)).toBeUndefined();
    expect(buildSearchRegex(null)).toBeUndefined();
    expect(buildSearchRegex(42)).toBeUndefined();
    expect(buildSearchRegex({ $ne: '' })).toBeUndefined();
    expect(buildSearchRegex([42])).toBeUndefined();
    expect(buildSearchRegex([])).toBeUndefined();
  });

  // 4. Surrounding whitespace is trimmed
  it('should trim surrounding whitespace', () => {
    expect(buildSearchRegex('  nano  ')).toEqual({ $regex: 'nano', $options: 'i' });
  });

  // 5. Blank / whitespace-only input yields undefined
  it('should return undefined for empty or whitespace-only strings', () => {
    expect(buildSearchRegex('')).toBeUndefined();
    expect(buildSearchRegex('   ')).toBeUndefined();
  });

  // 6. The pattern is capped at 80 characters after trimming
  it('should cap the pattern at 80 characters', () => {
    const long = 'a'.repeat(100);

    const result = buildSearchRegex(long);

    expect(result.$regex).toHaveLength(80);
    expect(result.$regex).toBe('a'.repeat(80));
  });

  // 7. The cap applies after trimming, so leading spaces do not eat into the budget
  it('should trim before applying the 80-character cap', () => {
    const result = buildSearchRegex('   ' + 'b'.repeat(90));

    expect(result.$regex).toBe('b'.repeat(80));
  });

  // 8. Every regex metacharacter is escaped so the value matches literally
  it('should escape all regex metacharacters', () => {
    expect(buildSearchRegex('.*+?^${}()|[]\\')).toEqual({
      $regex: '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\',
      $options: 'i',
    });
    expect(buildSearchRegex('nano (x)')).toEqual({ $regex: 'nano \\(x\\)', $options: 'i' });
  });

  // 9. Escaping happens after the cap, so the escaped output may exceed 80 chars
  it('should apply the cap to the raw text, not the escaped output', () => {
    const result = buildSearchRegex('.'.repeat(100));

    expect(result.$regex).toBe('\\.'.repeat(80));
  });

  // 10. Hyphens and non-ASCII text (Arabic) pass through untouched
  it('should leave hyphens and Arabic text untouched', () => {
    expect(buildSearchRegex('خدمات-السيارات')).toEqual({ $regex: 'خدمات-السيارات', $options: 'i' });
  });
});
