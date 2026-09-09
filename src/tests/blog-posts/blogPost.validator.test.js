import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
// sanitize-html is CJS and `require()`s the ESM-only htmlparser2@12. Node 22 handles that via
// require(esm), but Jest's CJS runtime cannot, so the library is mocked here. The validator owns
// the *allowlist configuration*, which is what these tests assert via the mock's arguments.
const mockSanitize = jest.fn((html) => `SANITIZED(${html})`);
jest.unstable_mockModule('sanitize-html', () => ({ default: mockSanitize }));

const { createBlogPostSchema, updateBlogPostSchema } = await import('../../validators/blogPost.validator.js');

const CATEGORY_ID = '64a1f0c2e4b0a1b2c3d4e5f7';
const valid = { title: 'Hello', content: '<p>Body</p>' };
const issuePaths = (result) => result.error.issues.map((i) => i.path.join('.'));

describe('BlogPosts — createBlogPostSchema', () => {
  // 1. Minimal valid body passes and unknown keys are stripped
  it('should accept title + content and strip unknown keys', () => {
    const result = createBlogPostSchema.safeParse({ ...valid, isDeleted: true, author: 'x' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ title: 'Hello', content: 'SANITIZED(<p>Body</p>)' });
  });

  // 2. title and content are required
  it('should require title and content', () => {
    const result = createBlogPostSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(expect.arrayContaining(['title', 'content']));
  });

  // 3. title length is bounded 2..200
  it('should enforce title min 2 / max 200', () => {
    expect(createBlogPostSchema.safeParse({ ...valid, title: 'a' }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...valid, title: 'ab' }).success).toBe(true);
    expect(createBlogPostSchema.safeParse({ ...valid, title: 'a'.repeat(200) }).success).toBe(true);
    expect(createBlogPostSchema.safeParse({ ...valid, title: 'a'.repeat(201) }).success).toBe(false);
  });

  // 4. content must be non-empty and is never sanitised when it fails validation
  it('should reject empty content without calling the sanitiser', () => {
    const result = createBlogPostSchema.safeParse({ ...valid, content: '' });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(['content']);
    expect(mockSanitize).not.toHaveBeenCalled();
  });

  // 5. excerpt and coverImageAlt are capped at 300
  it('should cap excerpt and coverImageAlt at 300 characters', () => {
    expect(createBlogPostSchema.safeParse({ ...valid, excerpt: 'x'.repeat(300) }).success).toBe(true);
    expect(createBlogPostSchema.safeParse({ ...valid, excerpt: 'x'.repeat(301) }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...valid, coverImageAlt: 'x'.repeat(300) }).success).toBe(true);
    expect(createBlogPostSchema.safeParse({ ...valid, coverImageAlt: 'x'.repeat(301) }).success).toBe(false);
  });

  // 6. content is passed through sanitize-html and the sanitised output replaces the raw value
  it('should transform content through sanitize-html', () => {
    const dirty = '<p onclick="x()">Hi</p><script>alert(1)</script>';

    const { content } = createBlogPostSchema.parse({ ...valid, content: dirty });

    expect(mockSanitize).toHaveBeenCalledTimes(1);
    expect(mockSanitize.mock.calls[0][0]).toBe(dirty);
    expect(content).toBe(`SANITIZED(${dirty})`);
  });

  // 7. The sanitiser allowlist is the rich-text subset only: no script/iframe/style, no event handlers, safe schemes
  it('should configure sanitize-html with the rich-text allowlist and safe schemes', () => {
    createBlogPostSchema.parse(valid);

    const options = mockSanitize.mock.calls[0][1];
    expect(options.allowedTags).toEqual(expect.arrayContaining([
      'p', 'br', 'b', 'i', 'em', 'strong', 'u', 's', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'figure', 'figcaption',
    ]));
    expect(options.allowedTags).not.toEqual(expect.arrayContaining(['script']));
    expect(options.allowedTags).not.toEqual(expect.arrayContaining(['iframe']));
    expect(options.allowedTags).not.toEqual(expect.arrayContaining(['style']));
    expect(options.allowedAttributes).toEqual({ a: ['href', 'target', 'rel'], img: ['src', 'alt', 'width', 'height'] });
    expect(options.allowedSchemes).toEqual(['http', 'https', 'mailto']);
  });

  // 8. slug: trimmed, letters/numbers in any script and hyphens only
  it('should trim the slug and accept letters, numbers and hyphens in any script', () => {
    expect(createBlogPostSchema.parse({ ...valid, slug: '  my-post-2 ' }).slug).toBe('my-post-2');
    expect(createBlogPostSchema.parse({ ...valid, slug: 'تلميع-السيارات' }).slug).toBe('تلميع-السيارات');
    expect(createBlogPostSchema.parse({ ...valid, slug: '' }).slug).toBe('');
  });

  // 9. slug rejects spaces, punctuation and over-long values
  it('should reject slugs with spaces/punctuation or longer than 200', () => {
    expect(createBlogPostSchema.safeParse({ ...valid, slug: 'my post' }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...valid, slug: 'a/b' }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...valid, slug: 'a_b' }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...valid, slug: 'a'.repeat(201) }).success).toBe(false);
  });

  // 10. isPublished coerces multipart strings to booleans
  it("should coerce isPublished from 'true'/'false' strings and pass real booleans", () => {
    expect(createBlogPostSchema.parse({ ...valid, isPublished: 'true' }).isPublished).toBe(true);
    expect(createBlogPostSchema.parse({ ...valid, isPublished: 'false' }).isPublished).toBe(false);
    expect(createBlogPostSchema.parse({ ...valid, isPublished: true }).isPublished).toBe(true);
    expect(createBlogPostSchema.parse({ ...valid, isPublished: false }).isPublished).toBe(false);
    expect(createBlogPostSchema.parse(valid).isPublished).toBeUndefined();
  });

  // 11. isPublished rejects anything else
  it('should reject non-boolean isPublished values', () => {
    expect(createBlogPostSchema.safeParse({ ...valid, isPublished: 'yes' }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...valid, isPublished: 1 }).success).toBe(false);
  });

  // 12. tags accept an array or a comma-separated string (trimmed, blanks dropped)
  it('should accept tags as an array or a comma-separated string', () => {
    expect(createBlogPostSchema.parse({ ...valid, tags: ['a', 'b'] }).tags).toEqual(['a', 'b']);
    expect(createBlogPostSchema.parse({ ...valid, tags: ' a , b,, c ' }).tags).toEqual(['a', 'b', 'c']);
    expect(createBlogPostSchema.parse({ ...valid, tags: '' }).tags).toEqual([]);
    expect(createBlogPostSchema.safeParse({ ...valid, tags: [1] }).success).toBe(false);
  });

  // 13. categories: array form enforces 24-char ids
  it('should accept an array of 24-char category ids and reject malformed ids in the array form', () => {
    expect(createBlogPostSchema.parse({ ...valid, categories: [CATEGORY_ID] }).categories).toEqual([CATEGORY_ID]);

    const result = createBlogPostSchema.safeParse({ ...valid, categories: ['short'] });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(['categories.0']);
  });

  // 14. categories: comma-separated string form is split/trimmed (NOTE: length is not enforced on this branch)
  it('should split a comma-separated categories string without length validation (current behaviour)', () => {
    expect(createBlogPostSchema.parse({ ...valid, categories: `${CATEGORY_ID}, ${CATEGORY_ID}` }).categories)
      .toEqual([CATEGORY_ID, CATEGORY_ID]);
    // Bug-ish: the string branch bypasses .length(24), so a malformed id slips through here.
    expect(createBlogPostSchema.parse({ ...valid, categories: 'short' }).categories).toEqual(['short']);
  });
});

describe('BlogPosts — updateBlogPostSchema', () => {
  // 1. Everything is optional on update
  it('should accept an empty body', () => {
    const result = updateBlogPostSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  // 2. Provided fields keep their constraints and transforms
  it('should still validate and transform provided fields', () => {
    expect(updateBlogPostSchema.safeParse({ title: 'a' }).success).toBe(false);
    expect(updateBlogPostSchema.parse({ isPublished: 'true' }).isPublished).toBe(true);
    expect(updateBlogPostSchema.parse({ tags: 'x, y' }).tags).toEqual(['x', 'y']);
    expect(updateBlogPostSchema.parse({ content: '<p>ok</p>' }).content).toBe('SANITIZED(<p>ok</p>)');
    expect(updateBlogPostSchema.safeParse({ content: '' }).success).toBe(false);
  });

  // 3. Slug rules apply on update too
  it('should apply slug rules on update', () => {
    expect(updateBlogPostSchema.parse({ slug: ' new-slug ' }).slug).toBe('new-slug');
    expect(updateBlogPostSchema.safeParse({ slug: 'bad slug' }).success).toBe(false);
  });
});
