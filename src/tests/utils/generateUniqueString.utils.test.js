// Pure util (wraps nanoid's customAlphabet) — no mocks required.
const { generateUniqueString } = await import('../../utils/generate-Unique-String.js');

const ALPHANUMERIC = /^[A-Za-z0-9]+$/;

describe('Utils — generateUniqueString', () => {
  // 1. Default length is 13
  it('should return a 13-character string by default', () => {
    const value = generateUniqueString();

    expect(typeof value).toBe('string');
    expect(value).toHaveLength(13);
  });

  // 2. Explicit length is honoured
  it('should honour an explicit length', () => {
    expect(generateUniqueString(5)).toHaveLength(5);
    expect(generateUniqueString(32)).toHaveLength(32);
  });

  // 3. Falsy length (0 / undefined / null) falls back to 13
  it('should fall back to 13 when length is falsy', () => {
    expect(generateUniqueString(0)).toHaveLength(13);
    expect(generateUniqueString(null)).toHaveLength(13);
  });

  // 4. Only the configured alphabet is used (A-Z a-z 0-9)
  it('should only contain letters and digits', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(generateUniqueString(40)).toMatch(ALPHANUMERIC);
    }
  });

  // 5. Successive calls produce distinct values
  it('should produce unique values across calls', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateUniqueString()));

    expect(values.size).toBe(50);
  });
});
