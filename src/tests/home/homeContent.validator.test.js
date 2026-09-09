// Validators need no mocks: import the schema and parse.
import { updateHomeContentSchema } from '../../validators/homeContent.validator.js';

const threeTrust = [{ head: 'a' }, { head: 'b' }, { head: 'c' }];
const threeStats = [{ value: 1 }, { value: 2 }, { value: 3 }];

describe('HomeContent validator — shape and strip', () => {
  // 1. Every field is optional
  it('should accept an empty body and return an empty object', () => {
    expect(updateHomeContentSchema.parse({})).toEqual({});
  });

  // 2. Unknown keys (media paths, ids) are stripped rather than rejected
  it('should strip media paths, ids and unknown keys', () => {
    const result = updateHomeContentSchema.parse({
      'hero.ctaLabel': 'Book',
      'hero.video': 'https://cdn/v.mp4',
      'hero.videoPublicId': 'stolen',
      'hero.poster': 'x',
      'whyUs.image.url': 'x',
      'whyUs.image.publicId': 'x',
      singletonKey: 'other',
      _id: 'hack',
      random: 1,
    });

    expect(result).toEqual({ 'hero.ctaLabel': 'Book' });
    expect(result).not.toHaveProperty('hero.videoPublicId');
    expect(result).not.toHaveProperty('singletonKey');
    expect(result).not.toHaveProperty('_id');
  });

  // 3. Plain text fields pass through unchanged
  it('should pass through every dotted text field', () => {
    const body = {
      'hero.ctaLabel': 'Book now', 'hero.ctaText': 'Text',
      'heroTiles.servicesLabel': 'Services', 'heroTiles.branches.label': 'Branches',
      'heroTiles.branches.href': '/branches', 'heroTiles.branches.image.alt': 'alt',
      'heroTiles.gallery.label': 'Gallery', 'heroTiles.gallery.image.alt': 'alt',
      'whyUs.heading': 'Why', 'whyUs.description': 'Desc', 'whyUs.ctaLabel': 'Go', 'whyUs.image.alt': 'alt',
      'reviewsIntro.heading': 'Reviews', 'reviewsIntro.description': 'Desc',
      'contactBlock.heading': 'Contact', 'contactBlock.subheading': 'Sub', 'contactBlock.formTitle': 'Form',
      'sections.partnersHeading': 'Partners', 'sections.partnersSub': 'Sub',
      'sections.latestPostsHeading': 'Latest', 'sections.ctaLabel': 'CTA',
    };

    expect(updateHomeContentSchema.parse(body)).toEqual(body);
  });
});

describe('HomeContent validator — max lengths', () => {
  // 1. Boundary: exactly max passes, max+1 fails (representative fields)
  it.each([
    ['hero.ctaLabel', 20],
    ['hero.ctaText', 300],
    ['heroTiles.servicesLabel', 120],
    ['heroTiles.branches.href', 500],
    ['whyUs.heading', 40],
    ['whyUs.description', 300],
    ['whyUs.ctaLabel', 20],
    ['reviewsIntro.heading', 30],
    ['reviewsIntro.description', 80],
    ['contactBlock.heading', 30],
    ['contactBlock.subheading', 80],
    ['contactBlock.formTitle', 20],
    ['sections.partnersHeading', 30],
    ['sections.partnersSub', 80],
    ['sections.latestPostsHeading', 30],
    ['sections.ctaLabel', 20],
  ])('should cap %s at %i characters', (field, max) => {
    expect(updateHomeContentSchema.safeParse({ [field]: 'x'.repeat(max) }).success).toBe(true);
    const tooLong = updateHomeContentSchema.safeParse({ [field]: 'x'.repeat(max + 1) });
    expect(tooLong.success).toBe(false);
    expect(tooLong.error.issues[0].path).toEqual([field]);
  });

  // 2. Text fields must be strings
  it('should reject a non-string text field', () => {
    expect(updateHomeContentSchema.safeParse({ 'hero.ctaLabel': 12 }).success).toBe(false);
  });
});

describe('HomeContent validator — hero dimensions (numberish)', () => {
  // 1. Multipart strings are coerced to integers
  it('should coerce string dimensions to positive integers', () => {
    expect(updateHomeContentSchema.parse({ 'hero.width': '1920', 'hero.height': '1080' }))
      .toEqual({ 'hero.width': 1920, 'hero.height': 1080 });
    expect(updateHomeContentSchema.parse({ 'hero.width': 640 })).toEqual({ 'hero.width': 640 });
  });

  // 2. Zero, negatives, decimals and junk are rejected
  it.each(['0', '-5', '1.5', 'abc', ''])('should reject hero.width %p', (value) => {
    expect(updateHomeContentSchema.safeParse({ 'hero.width': value }).success).toBe(false);
  });
});

describe('HomeContent validator — trust (jsonish, exactly 3)', () => {
  // 1. A JSON string from multipart is parsed into the array
  it('should parse a JSON string into a trust array with defaults filled', () => {
    const result = updateHomeContentSchema.parse({ trust: JSON.stringify([{ head: 'A', alt: 'alt' }, {}, { icon: 'star' }]) });

    expect(result.trust).toEqual([
      { head: 'A', sub: '', icon: '', alt: 'alt' },
      { head: '', sub: '', icon: '' },
      { head: '', sub: '', icon: 'star' },
    ]);
  });

  // 2. A real array (JSON body) passes through
  it('should accept a real array', () => {
    expect(updateHomeContentSchema.parse({ trust: threeTrust }).trust).toHaveLength(3);
  });

  // 3. Exactly three badges are required
  it.each([[0], [2], [4]])('should reject a trust array of length %i', (n) => {
    const result = updateHomeContentSchema.safeParse({ trust: Array.from({ length: n }, () => ({})) });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['trust']);
  });

  // 4. Malformed JSON surfaces as a type error on the trust path
  it('should report malformed JSON as an error on the trust field', () => {
    const result = updateHomeContentSchema.safeParse({ trust: '{not json' });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['trust']);
  });

  // 5. Item field lengths are enforced
  it('should enforce head/sub/icon/alt max lengths', () => {
    expect(updateHomeContentSchema.safeParse({ trust: [{ head: 'x'.repeat(21) }, {}, {}] }).success).toBe(false);
    expect(updateHomeContentSchema.safeParse({ trust: [{ sub: 'x'.repeat(41) }, {}, {}] }).success).toBe(false);
    expect(updateHomeContentSchema.safeParse({ trust: [{ icon: 'x'.repeat(61) }, {}, {}] }).success).toBe(false);
    expect(updateHomeContentSchema.safeParse({ trust: [{ alt: 'x'.repeat(301) }, {}, {}] }).success).toBe(false);
    expect(updateHomeContentSchema.safeParse({ trust: [{ head: 'x'.repeat(20), sub: 'x'.repeat(40), icon: 'x'.repeat(60), alt: 'x'.repeat(300) }, {}, {}] }).success).toBe(true);
  });

  // 6. Image fields inside trust items are stripped (media comes from uploads)
  it('should strip image objects nested inside trust items', () => {
    const result = updateHomeContentSchema.parse({ trust: [{ head: 'A', image: { publicId: 'x' } }, {}, {}] });
    expect(result.trust[0]).toEqual({ head: 'A', sub: '', icon: '' });
  });
});

describe('HomeContent validator — stats (jsonish, exactly 3)', () => {
  // 1. Values are coerced to numbers and defaults filled
  it('should parse a JSON string and coerce value to a number', () => {
    const result = updateHomeContentSchema.parse({ stats: JSON.stringify([{ value: '25', suffix: 'K', title: 'Clients' }, {}, { value: 3 }]) });

    expect(result.stats).toEqual([
      { value: 25, suffix: 'K', title: 'Clients' },
      { value: 0, suffix: '', title: '' },
      { value: 3, suffix: '', title: '' },
    ]);
  });

  // 2. Exactly three figures
  it.each([[2], [4]])('should reject a stats array of length %i', (n) => {
    expect(updateHomeContentSchema.safeParse({ stats: Array.from({ length: n }, () => ({ value: 1 })) }).success).toBe(false);
  });

  // 3. Current behaviour: z.coerce.number() turns a null value into 0 instead of rejecting it
  it('should coerce a null stats value to 0 rather than reject it', () => {
    const result = updateHomeContentSchema.parse({ stats: [{ value: null }, {}, {}] });
    expect(result.stats[0]).toEqual({ value: 0, suffix: '', title: '' });
  });

  // 4. Non-numeric value and over-long suffix/title are rejected
  it('should reject a non-numeric value and over-long suffix/title', () => {
    expect(updateHomeContentSchema.safeParse({ stats: [{ value: 'abc' }, {}, {}] }).success).toBe(false);
    expect(updateHomeContentSchema.safeParse({ stats: [{ suffix: 'x'.repeat(7) }, {}, {}] }).success).toBe(false);
    expect(updateHomeContentSchema.safeParse({ stats: [{ title: 'x'.repeat(17) }, {}, {}] }).success).toBe(false);
    expect(updateHomeContentSchema.safeParse({ stats: [{ suffix: 'x'.repeat(6), title: 'x'.repeat(16) }, {}, {}] }).success).toBe(true);
    expect(updateHomeContentSchema.safeParse({ stats: threeStats }).success).toBe(true);
  });
});

describe('HomeContent validator — whyUs.points and gallery actions (jsonish)', () => {
  // 1. Points parse from JSON and are capped at 20 items of 70 chars
  it('should parse points from JSON and enforce item length and count', () => {
    expect(updateHomeContentSchema.parse({ 'whyUs.points': '["a","b"]' })['whyUs.points']).toEqual(['a', 'b']);
    expect(updateHomeContentSchema.parse({ 'whyUs.points': [] })['whyUs.points']).toEqual([]);
    expect(updateHomeContentSchema.safeParse({ 'whyUs.points': ['x'.repeat(71)] }).success).toBe(false);
    expect(updateHomeContentSchema.safeParse({ 'whyUs.points': Array.from({ length: 21 }, () => 'p') }).success).toBe(false);
    expect(updateHomeContentSchema.safeParse({ 'whyUs.points': Array.from({ length: 20 }, () => 'x'.repeat(70)) }).success).toBe(true);
    expect(updateHomeContentSchema.safeParse({ 'whyUs.points': [1] }).success).toBe(false);
  });

  // 2. Gallery actions parse from JSON with defaults and a max of 4
  it('should parse gallery actions from JSON with defaults and cap at 4', () => {
    const result = updateHomeContentSchema.parse({ 'heroTiles.gallery.actions': JSON.stringify([{ label: 'Photos' }, { href: '/v', icon: 'play' }]) });

    expect(result['heroTiles.gallery.actions']).toEqual([
      { label: 'Photos', href: '', icon: '' },
      { label: '', href: '/v', icon: 'play' },
    ]);
    expect(updateHomeContentSchema.safeParse({ 'heroTiles.gallery.actions': Array.from({ length: 5 }, () => ({})) }).success).toBe(false);
    expect(updateHomeContentSchema.safeParse({ 'heroTiles.gallery.actions': Array.from({ length: 4 }, () => ({})) }).success).toBe(true);
    expect(updateHomeContentSchema.safeParse({ 'heroTiles.gallery.actions': [{ label: 'x'.repeat(121) }] }).success).toBe(false);
    expect(updateHomeContentSchema.safeParse({ 'heroTiles.gallery.actions': [{ href: 'x'.repeat(501) }] }).success).toBe(false);
    expect(updateHomeContentSchema.safeParse({ 'heroTiles.gallery.actions': [{ icon: 'x'.repeat(61) }] }).success).toBe(false);
  });

  // 3. A non-array JSON value is rejected
  it('should reject a JSON object where an array is expected', () => {
    expect(updateHomeContentSchema.safeParse({ 'whyUs.points': '{"a":1}' }).success).toBe(false);
    expect(updateHomeContentSchema.safeParse({ 'heroTiles.gallery.actions': '"str"' }).success).toBe(false);
  });
});
