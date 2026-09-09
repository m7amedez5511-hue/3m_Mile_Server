// Pure util — no mocks required.
const { transliterateArabic, isArabic } = await import('../../utils/transliterateArabic.js');

describe('Utils — transliterateArabic', () => {
  // 1. Single mapped letters
  it('should map single Arabic letters to their Latin equivalents', () => {
    expect(transliterateArabic('ب')).toBe('b');
    expect(transliterateArabic('ث')).toBe('th');
    expect(transliterateArabic('خ')).toBe('kh');
    expect(transliterateArabic('ش')).toBe('sh');
    expect(transliterateArabic('غ')).toBe('gh');
    expect(transliterateArabic('آ')).toBe('aa');
  });

  // 2. A full word is transliterated character by character
  it('should transliterate a full Arabic word', () => {
    // م ح م د → m h m d
    expect(transliterateArabic('محمد')).toBe('mhmd');
    // س ي ا ر ة → s y a r a
    expect(transliterateArabic('سيارة')).toBe('syara');
  });

  // 3. Non-alphanumeric characters (spaces, punctuation, unmapped Arabic marks) are removed
  it('should strip spaces, punctuation and unmapped characters', () => {
    expect(transliterateArabic('خدمات السيارات')).toBe('khdmatalsyarat');
    expect(transliterateArabic('a-b_c!')).toBe('abc');
    // tashkeel (fatha) is not in the map and is not alphanumeric → dropped
    expect(transliterateArabic('بَ')).toBe('b');
  });

  // 4. Latin text is lowercased and digits kept
  it('should lowercase Latin text and keep digits', () => {
    expect(transliterateArabic('Hello World 42')).toBe('helloworld42');
  });

  // 5. Mixed Arabic/Latin input
  it('should handle mixed Arabic and Latin input', () => {
    expect(transliterateArabic('3M ميل')).toBe('3mmyl');
  });

  // 6. Empty string → empty string
  it('should return an empty string for empty input', () => {
    expect(transliterateArabic('')).toBe('');
  });

  // 7. Multi-letter outputs are lowercased too (map values are already lowercase)
  it('should produce all-lowercase output', () => {
    const out = transliterateArabic('ثشخغ');

    expect(out).toBe('thshkhgh');
    expect(out).toBe(out.toLowerCase());
  });
});

describe('Utils — isArabic', () => {
  // 1. Text containing any Arabic-block character is Arabic
  it('should return true when the text contains Arabic characters', () => {
    expect(isArabic('خدمات')).toBe(true);
    expect(isArabic('3M ميل')).toBe(true);
    expect(isArabic('،')).toBe(true);
  });

  // 2. Pure Latin / digits / empty text is not Arabic
  it('should return false for Latin, digits and empty text', () => {
    expect(isArabic('hello')).toBe(false);
    expect(isArabic('12345')).toBe(false);
    expect(isArabic('')).toBe(false);
  });

  // 3. Other non-Latin scripts outside U+0600–U+06FF are not Arabic
  it('should return false for non-Arabic scripts', () => {
    expect(isArabic('日本語')).toBe(false);
    expect(isArabic('Привет')).toBe(false);
  });
});
