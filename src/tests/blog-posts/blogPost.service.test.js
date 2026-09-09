import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockCrud = {
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
};
const mockResolveSlug = jest.fn();
const mockSafeDelete = jest.fn().mockResolvedValue(undefined);
const mockLogAudit = jest.fn();
const mockActorFromReq = jest.fn(() => ({ userId: 'admin-id', ip: '127.0.0.1' }));

jest.unstable_mockModule('../../services/crud.service.js', () => ({ default: () => mockCrud }));
jest.unstable_mockModule('../../utils/buildSlugify.js', () => ({ resolveSlug: mockResolveSlug }));
jest.unstable_mockModule('../../utils/softDeleteImage.js', () => ({ safeDeleteCloudinaryImage: mockSafeDelete }));
jest.unstable_mockModule('../../utils/auditLogger.js', () => ({ logAudit: mockLogAudit, actorFromReq: mockActorFromReq }));
// The service imports these but never calls them; mocked so the Cloudinary SDK / winston never load.
jest.unstable_mockModule('../../utils/Cloudinary.config.js', () => ({
  deleteImage: jest.fn(), uploadImage: jest.fn(), initCloudinary: jest.fn(),
}));
jest.unstable_mockModule('../../utils/winston.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const {
  listBlogPosts, getBlogPostBySlug, getBlogPostById, createBlogPost, updateBlogPost, deleteBlogPost,
} = await import('../../services/blogPost.service.js');

const POST_ID = '64a1f0c2e4b0a1b2c3d4e5f6';
const CATEGORY_ID = '64a1f0c2e4b0a1b2c3d4e5f7';
const AUTHOR_ID = '64a1f0c2e4b0a1b2c3d4e5f8';
const POPULATE = [
  { path: 'author', localField: 'author', collection: 'users', select: ['fullName'] },
  { path: 'categories', localField: 'categories', collection: 'categories', select: ['name', 'slug'] },
];
const mockReq = (body = {}, extra = {}) => ({ body, ip: '127.0.0.1', user: { _id: AUTHOR_ID }, ...extra });

describe('BlogPosts — listBlogPosts', () => {
  // 1. Default listing filters out soft-deleted rows, sorts by publishedAt then createdAt and populates author + categories
  it('should query non-deleted posts sorted by publishedAt/createdAt with author and categories populated', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listBlogPosts();

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith(
      { isDeleted: false },
      { page: 1, limit: 10, sort: { publishedAt: -1, createdAt: -1 }, populate: POPULATE },
    );
  });

  // 2. Search text must be escaped and matched case-insensitively against the title
  it('should add an escaped case-insensitive title regex when search is provided', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listBlogPosts({ search: 'wax (3m)?' });

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith(
      { isDeleted: false, title: { $regex: 'wax \\(3m\\)\\?', $options: 'i' } },
      expect.any(Object),
    );
  });

  // 3. Blank search must not add a title filter
  it('should ignore a blank search string', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listBlogPosts({ search: '   ' });

    expect(mockCrud.findAndCountAll.mock.calls[0][0]).toEqual({ isDeleted: false });
  });

  // 4. isPublished is only applied when explicitly passed (false included)
  it('should apply isPublished when provided and skip it when undefined', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listBlogPosts({ isPublished: false });
    await listBlogPosts({ isPublished: true });
    await listBlogPosts({ isPublished: undefined });

    expect(mockCrud.findAndCountAll.mock.calls[0][0]).toEqual({ isDeleted: false, isPublished: false });
    expect(mockCrud.findAndCountAll.mock.calls[1][0]).toEqual({ isDeleted: false, isPublished: true });
    expect(mockCrud.findAndCountAll.mock.calls[2][0]).toEqual({ isDeleted: false });
  });

  // 5. Category id must be cast to ObjectId and applied to the plural `categories` key
  it('should cast the category filter to an ObjectId on the categories key', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listBlogPosts({ category: CATEGORY_ID });

    const filter = mockCrud.findAndCountAll.mock.calls[0][0];
    expect(filter.category).toBeUndefined();
    expect(filter.categories).not.toBe(CATEGORY_ID);
    expect(String(filter.categories)).toBe(CATEGORY_ID);
  });

  // 6. Valid pagination values are forwarded as numbers
  it('should forward numeric page and limit (coercing numeric strings)', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listBlogPosts({ page: '3', limit: '25' });

    expect(mockCrud.findAndCountAll.mock.calls[0][1]).toMatchObject({ page: 3, limit: 25 });
  });

  // 7. limit is clamped to MAX_PAGE_LIMIT (100)
  it('should clamp limit to 100', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listBlogPosts({ limit: 999999 });

    expect(mockCrud.findAndCountAll.mock.calls[0][1]).toMatchObject({ limit: 100 });
  });

  // 8. Non-numeric / zero page and limit fall back to defaults (1 / 10); negatives floor at 1
  it('should fall back to page 1 / limit 10 for invalid or zero values and floor negatives at 1', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listBlogPosts({ page: 'abc', limit: 'abc' });
    await listBlogPosts({ page: 0, limit: 0 });
    await listBlogPosts({ page: -5, limit: -5 });

    expect(mockCrud.findAndCountAll.mock.calls[0][1]).toMatchObject({ page: 1, limit: 10 });
    expect(mockCrud.findAndCountAll.mock.calls[1][1]).toMatchObject({ page: 1, limit: 10 });
    expect(mockCrud.findAndCountAll.mock.calls[2][1]).toMatchObject({ page: 1, limit: 1 });
  });
});

describe('BlogPosts — getBlogPostBySlug', () => {
  // 1. Slug lookup excludes deleted rows and populates author + categories
  it('should look up by slug with isDeleted:false and return the document', async () => {
    const doc = { _id: POST_ID, slug: 'hello' };
    mockCrud.findOne.mockResolvedValue(doc);

    const result = await getBlogPostBySlug('hello');

    expect(mockCrud.findOne).toHaveBeenCalledWith({ slug: 'hello', isDeleted: false }, { populate: POPULATE });
    expect(result).toBe(doc);
  });

  // 2. Unknown slug → 404
  it('should throw 404 blog_post_not_found for an unknown slug', async () => {
    mockCrud.findOne.mockResolvedValue(null);

    await expect(getBlogPostBySlug('nope')).rejects.toMatchObject({ status: 404, code: 'blog_post_not_found' });
  });
});

describe('BlogPosts — getBlogPostById', () => {
  // 1. Found post is returned with only the author populated
  it('should return the post when found and not deleted, populating author only', async () => {
    const post = { _id: POST_ID, title: 'T', isDeleted: false };
    mockCrud.findByPk.mockResolvedValue(post);

    const result = await getBlogPostById(POST_ID);

    expect(mockCrud.findByPk).toHaveBeenCalledWith(POST_ID, {
      populate: [{ path: 'author', localField: 'author', collection: 'users', select: ['fullName'] }],
    });
    expect(result).toBe(post);
  });

  // 2. Missing post → 404
  it('should throw 404 blog_post_not_found when nothing matches', async () => {
    mockCrud.findByPk.mockResolvedValue(null);

    await expect(getBlogPostById(POST_ID)).rejects.toMatchObject({ status: 404, code: 'blog_post_not_found' });
  });

  // 3. Soft-deleted post is treated as missing
  it('should throw 404 when the post is soft-deleted', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: POST_ID, isDeleted: true });

    await expect(getBlogPostById(POST_ID)).rejects.toMatchObject({ status: 404, code: 'blog_post_not_found' });
  });
});

describe('BlogPosts — createBlogPost', () => {
  // 1. Whitelisted fields, author from req.user, unpublished defaults and derived slug
  it('should build the document from whitelisted fields with author, isPublished:false and publishedAt:null', async () => {
    mockResolveSlug.mockResolvedValue('hello-world');
    mockCrud.create.mockImplementation(async (data) => ({ _id: POST_ID, ...data }));

    const result = await createBlogPost(mockReq({
      title: 'Hello World', excerpt: 'ex', content: '<p>c</p>', tags: ['a'], categories: [CATEGORY_ID],
    }));

    expect(mockResolveSlug).toHaveBeenCalledWith('BlogPost', undefined, 'Hello World');
    expect(mockCrud.create).toHaveBeenCalledWith({
      title: 'Hello World',
      excerpt: 'ex',
      content: '<p>c</p>',
      tags: ['a'],
      categories: [CATEGORY_ID],
      author: AUTHOR_ID,
      isPublished: false,
      publishedAt: null,
      slug: 'hello-world',
    });
    expect(result._id).toBe(POST_ID);
  });

  // 2. Non-whitelisted body keys never reach the database (author/isDeleted/slug/coverImage/publishedAt)
  it('should ignore author, isDeleted, coverImage and publishedAt from the body', async () => {
    mockResolveSlug.mockResolvedValue('t');
    mockCrud.create.mockResolvedValue({ _id: POST_ID });

    await createBlogPost(mockReq({
      title: 'T', content: 'c', author: 'evil', isDeleted: true, coverImage: { url: 'x' }, publishedAt: new Date(0), deletedAt: new Date(0),
    }));

    const data = mockCrud.create.mock.calls[0][0];
    expect(data.author).toBe(AUTHOR_ID);
    expect(data.isDeleted).toBeUndefined();
    expect(data.coverImage).toBeUndefined();
    expect(data.deletedAt).toBeUndefined();
    expect(data.publishedAt).toBeNull();
  });

  // 3. Publishing at creation stamps publishedAt with the current date
  it('should set publishedAt to now when isPublished is true', async () => {
    mockResolveSlug.mockResolvedValue('t');
    mockCrud.create.mockResolvedValue({ _id: POST_ID });
    const before = Date.now();

    await createBlogPost(mockReq({ title: 'T', content: 'c', isPublished: true }));

    const data = mockCrud.create.mock.calls[0][0];
    expect(data.isPublished).toBe(true);
    expect(data.publishedAt).toEqual(expect.any(Date));
    expect(data.publishedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  // 4. An admin-supplied slug is passed through to resolveSlug
  it('should pass the admin-supplied slug to resolveSlug', async () => {
    mockResolveSlug.mockResolvedValue('custom');
    mockCrud.create.mockResolvedValue({ _id: POST_ID });

    await createBlogPost(mockReq({ title: 'Any', content: 'c', slug: 'custom' }));

    expect(mockResolveSlug).toHaveBeenCalledWith('BlogPost', 'custom', 'Any');
    expect(mockCrud.create.mock.calls[0][0].slug).toBe('custom');
  });

  // 5. Author falls back to req.user.id when _id is absent
  it('should use req.user.id when req.user._id is missing', async () => {
    mockResolveSlug.mockResolvedValue('t');
    mockCrud.create.mockResolvedValue({ _id: POST_ID });

    await createBlogPost(mockReq({ title: 'T', content: 'c' }, { user: { id: 'uid-2' } }));

    expect(mockCrud.create.mock.calls[0][0].author).toBe('uid-2');
  });

  // 6. Uploaded cover image is mapped to the coverImage slot with alt/width/height
  it('should map uploadedFile into coverImage with alt, width and height', async () => {
    mockResolveSlug.mockResolvedValue('t');
    mockCrud.create.mockResolvedValue({ _id: POST_ID });
    const uploadedFile = { url: 'https://cdn/c.png', publicId: 'cover-1', width: 800, height: 600 };

    await createBlogPost(mockReq({ title: 'T', content: 'c', coverImageAlt: 'A cover' }, { uploadedFile }));

    expect(mockCrud.create.mock.calls[0][0].coverImage).toEqual({
      url: 'https://cdn/c.png', imagePublicId: 'cover-1', alt: 'A cover', width: 800, height: 600,
    });
  });

  // 7. Missing alt / dimensions on upload default to '' / null
  it("should default alt to '' and width/height to null when the upload lacks them", async () => {
    mockResolveSlug.mockResolvedValue('t');
    mockCrud.create.mockResolvedValue({ _id: POST_ID });

    await createBlogPost(mockReq({ title: 'T', content: 'c' }, { uploadedFile: { url: 'u', publicId: 'p' } }));

    expect(mockCrud.create.mock.calls[0][0].coverImage).toEqual({ url: 'u', imagePublicId: 'p', alt: '', width: null, height: null });
  });

  // 8. Alt text with no upload is still persisted
  it('should persist coverImage.alt when only coverImageAlt is sent', async () => {
    mockResolveSlug.mockResolvedValue('t');
    mockCrud.create.mockResolvedValue({ _id: POST_ID });

    await createBlogPost(mockReq({ title: 'T', content: 'c', coverImageAlt: 'alt only' }));

    expect(mockCrud.create.mock.calls[0][0].coverImage).toEqual({ alt: 'alt only' });
  });

  // 9. No upload and no alt leaves coverImage untouched
  it('should not set coverImage when neither upload nor alt is present', async () => {
    mockResolveSlug.mockResolvedValue('t');
    mockCrud.create.mockResolvedValue({ _id: POST_ID });

    await createBlogPost(mockReq({ title: 'T', content: 'c' }));

    expect(mockCrud.create.mock.calls[0][0]).not.toHaveProperty('coverImage');
  });

  // 10. A CREATE audit entry is written for the acting admin
  it('should log a CREATE audit entry with the actor, post id and title', async () => {
    mockResolveSlug.mockResolvedValue('t');
    mockCrud.create.mockResolvedValue({ _id: POST_ID });
    const req = mockReq({ title: 'T', content: 'c' });

    await createBlogPost(req);

    expect(mockActorFromReq).toHaveBeenCalledWith(req);
    expect(mockLogAudit).toHaveBeenCalledWith({
      userId: 'admin-id', ip: '127.0.0.1', action: 'CREATE', resource: 'BlogPost', details: { id: POST_ID, title: 'T' },
    });
  });
});

describe('BlogPosts — updateBlogPost', () => {
  const existing = {
    _id: POST_ID, title: 'Orig', slug: 'orig', isPublished: false, isDeleted: false,
    coverImage: { url: 'https://cdn/old.png', imagePublicId: 'old-cover', alt: 'old alt' },
  };

  // 1. Only whitelisted fields reach the database
  it('should update only whitelisted fields (no slug/author/isDeleted/coverImage mass-assignment)', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue({ ...existing, title: 'New' });

    await updateBlogPost(POST_ID, mockReq({
      title: 'New', tags: ['x'], isDeleted: true, author: 'evil', coverImage: { url: 'x' }, publishedAt: new Date(0), deletedAt: null,
    }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: POST_ID }, { title: 'New', tags: ['x'] });
    expect(mockResolveSlug).not.toHaveBeenCalled();
  });

  // 2. Missing / deleted post → 404 and no write
  it('should throw 404 and not write when the post is missing or deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...existing, isDeleted: true });

    await expect(updateBlogPost(POST_ID, mockReq({ title: 'x' }))).rejects.toMatchObject({ status: 404, code: 'blog_post_not_found' });
    await expect(updateBlogPost(POST_ID, mockReq({ title: 'x' }))).rejects.toMatchObject({ status: 404, code: 'blog_post_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 3. Slug is only re-resolved when a slug key is present in the body (retitling alone keeps the URL)
  it('should re-resolve the slug only when req.body.slug is provided', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    mockResolveSlug.mockResolvedValue('renamed');

    await updateBlogPost(POST_ID, mockReq({ title: 'Renamed' }));
    expect(mockResolveSlug).not.toHaveBeenCalled();

    await updateBlogPost(POST_ID, mockReq({ slug: '' }));
    expect(mockResolveSlug).toHaveBeenCalledWith('BlogPost', '', 'Orig', POST_ID);
    expect(mockCrud.findOneAndUpdate).toHaveBeenLastCalledWith({ _id: POST_ID }, { slug: 'renamed' });
  });

  // 4. When both slug and title are sent, the new title is the slug fallback
  it('should derive the slug fallback from the incoming title when both are sent', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    mockResolveSlug.mockResolvedValue('new-title');

    await updateBlogPost(POST_ID, mockReq({ slug: '', title: 'New Title' }));

    expect(mockResolveSlug).toHaveBeenCalledWith('BlogPost', '', 'New Title', POST_ID);
  });

  // 5. Publishing an unpublished post stamps publishedAt
  it('should set publishedAt when transitioning from unpublished to published', async () => {
    mockCrud.findByPk.mockResolvedValue({ ...existing, isPublished: false });
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateBlogPost(POST_ID, mockReq({ isPublished: true }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: POST_ID }, { isPublished: true, publishedAt: expect.any(Date) });
  });

  // 6. Re-saving an already-published post keeps the original publishedAt
  it('should not touch publishedAt when the post is already published', async () => {
    mockCrud.findByPk.mockResolvedValue({ ...existing, isPublished: true });
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateBlogPost(POST_ID, mockReq({ isPublished: true }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: POST_ID }, { isPublished: true });
  });

  // 7. Unpublishing does not clear publishedAt
  it('should not set or clear publishedAt when unpublishing', async () => {
    mockCrud.findByPk.mockResolvedValue({ ...existing, isPublished: true });
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateBlogPost(POST_ID, mockReq({ isPublished: false }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: POST_ID }, { isPublished: false });
  });

  // 8. A new upload replaces the cover image and the old asset is deleted from Cloudinary
  it('should replace coverImage and delete the old asset with the UPDATE context', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    const uploadedFile = { url: 'https://cdn/new.png', publicId: 'new-cover', width: 10, height: 20 };

    await updateBlogPost(POST_ID, mockReq({ coverImageAlt: 'new alt' }, { uploadedFile }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: POST_ID }, {
      coverImage: { url: 'https://cdn/new.png', imagePublicId: 'new-cover', alt: 'new alt', width: 10, height: 20 },
    });
    expect(mockSafeDelete).toHaveBeenCalledTimes(1);
    expect(mockSafeDelete).toHaveBeenCalledWith('old-cover', { id: POST_ID, action: 'UPDATE' });
  });

  // 9. Upload without alt keeps the stored alt; dimensions default to null
  it('should fall back to the existing alt and null dimensions when the upload omits them', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateBlogPost(POST_ID, mockReq({}, { uploadedFile: { url: 'u', publicId: 'p' } }));

    expect(mockCrud.findOneAndUpdate.mock.calls[0][1].coverImage).toEqual({
      url: 'u', imagePublicId: 'p', alt: 'old alt', width: null, height: null,
    });
  });

  // 10. Upload when no previous cover exists → '' alt and no Cloudinary deletion
  it("should use '' alt and skip Cloudinary deletion when there was no previous cover", async () => {
    mockCrud.findByPk.mockResolvedValue({ ...existing, coverImage: undefined });
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateBlogPost(POST_ID, mockReq({}, { uploadedFile: { url: 'u', publicId: 'p' } }));

    expect(mockCrud.findOneAndUpdate.mock.calls[0][1].coverImage.alt).toBe('');
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 11. Alt text without a new upload is a dotted patch on the slot
  it('should patch coverImage.alt via a dotted key when only coverImageAlt is sent', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateBlogPost(POST_ID, mockReq({ coverImageAlt: 'patched' }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: POST_ID }, { 'coverImage.alt': 'patched' });
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 12. An UPDATE audit entry is written and the updated document is returned
  it('should log an UPDATE audit entry and return the updated post', async () => {
    const updated = { ...existing, title: 'x' };
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(updated);

    const result = await updateBlogPost(POST_ID, mockReq({ title: 'x' }));

    expect(result).toBe(updated);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', resource: 'BlogPost', details: { id: POST_ID } }));
  });
});

describe('BlogPosts — deleteBlogPost', () => {
  // 1. Soft delete: mark deleted with a deletedAt stamp, and keep the cover image on Cloudinary (restorable)
  it('should soft-delete the post with deletedAt and NOT delete the cover from Cloudinary', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: POST_ID, isDeleted: false, coverImage: { imagePublicId: 'cover' } });
    mockCrud.findOneAndUpdate.mockResolvedValue({ _id: POST_ID, isDeleted: true });

    const result = await deleteBlogPost(POST_ID, mockReq());

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: POST_ID }, { isDeleted: true, deletedAt: expect.any(Date) });
    expect(mockSafeDelete).not.toHaveBeenCalled();
    expect(result).toEqual({ _id: POST_ID, isDeleted: true });
  });

  // 2. Missing / already-deleted post → 404
  it('should throw 404 when the post is missing or already deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: POST_ID, isDeleted: true });

    await expect(deleteBlogPost(POST_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'blog_post_not_found' });
    await expect(deleteBlogPost(POST_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'blog_post_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 3. A DELETE audit entry is written
  it('should log a DELETE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: POST_ID, isDeleted: false });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await deleteBlogPost(POST_ID, mockReq());

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', resource: 'BlogPost', details: { id: POST_ID } }));
  });
});
