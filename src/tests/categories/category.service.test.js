import { jest } from '@jest/globals';

// ---- Mocks (registered BEFORE the module under test is imported) ----
const mockCrud = {
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
  aggregate: jest.fn(),
  count: jest.fn(),
};
const mockResolveSlug = jest.fn();
const mockLogAudit = jest.fn();
const mockActorFromReq = jest.fn(() => ({ userId: 'admin-id', ip: '127.0.0.1' }));

jest.unstable_mockModule('../../services/crud.service.js', () => ({ default: () => mockCrud }));
jest.unstable_mockModule('../../utils/buildSlugify.js', () => ({ resolveSlug: mockResolveSlug }));
jest.unstable_mockModule('../../utils/auditLogger.js', () => ({ logAudit: mockLogAudit, actorFromReq: mockActorFromReq }));

const {
  listCategories, getCategoryById, createCategory, updateCategory, deleteCategory, getCategoryBySlug,
} = await import('../../services/category.service.js');

const CATEGORY_ID = '64a1f0c2e4b0a1b2c3d4e5f7';
const mockReq = (body = {}, extra = {}) => ({ body, ip: '127.0.0.1', user: { _id: 'admin-id' }, ...extra });

describe('Categories — listCategories', () => {
  // 1. Default listing filters out soft-deleted rows, sorted by order then newest-first
  it('should query non-deleted categories sorted by order and createdAt', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listCategories();

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith(
      { isDeleted: false },
      { page: 1, limit: 10, sort: { order: 1, createdAt: -1 } },
    );
    expect(mockCrud.aggregate).not.toHaveBeenCalled();
  });

  // 2. Search text must be escaped and matched case-insensitively
  it('should add an escaped case-insensitive name regex when search is provided', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listCategories({ search: 'wax (x).*' });

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith(
      { isDeleted: false, name: { $regex: 'wax \\(x\\)\\.\\*', $options: 'i' } },
      expect.any(Object),
    );
  });

  // 3. Blank search must not add a name filter
  it('should ignore a blank search string', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listCategories({ search: '   ' });

    expect(mockCrud.findAndCountAll.mock.calls[0][0]).toEqual({ isDeleted: false });
  });

  // 4. Type filter is applied verbatim when provided
  it('should apply the type filter when provided', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listCategories({ type: 'blog' });

    expect(mockCrud.findAndCountAll.mock.calls[0][0]).toEqual({ isDeleted: false, type: 'blog' });
  });

  // 5. Pagination values are forwarded as given
  it('should forward page and limit', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listCategories({ page: 3, limit: 25 });

    expect(mockCrud.findAndCountAll.mock.calls[0][1]).toMatchObject({ page: 3, limit: 25 });
  });

  // 6. withCounts switches to an aggregation with a products $lookup for non-blog types
  it('should aggregate with a products lookup and return count/rows/total/data when withCounts is set', async () => {
    const rows = [{ _id: CATEGORY_ID, name: 'Wax', count: 2 }];
    mockCrud.aggregate.mockResolvedValue(rows);
    mockCrud.count.mockResolvedValue(1);

    const result = await listCategories({ withCounts: true, type: 'product' });

    expect(mockCrud.findAndCountAll).not.toHaveBeenCalled();
    const pipeline = mockCrud.aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({ $match: { isDeleted: false, type: 'product' } });
    expect(pipeline[1]).toEqual({ $sort: { order: 1, createdAt: -1 } });
    // page 1 → no $skip stage
    expect(pipeline[2]).toEqual({ $limit: 10 });
    expect(pipeline[3]).toEqual({
      $lookup: {
        from: 'products',
        let: { categoryId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$category', '$$categoryId'] }, isDeleted: false, isActive: true } },
          { $count: 'n' },
        ],
        as: '_counts',
      },
    });
    expect(pipeline[4]).toEqual({ $addFields: { count: { $ifNull: [{ $arrayElemAt: ['$_counts.n', 0] }, 0] } } });
    expect(pipeline[5]).toEqual({ $project: { _counts: 0 } });
    expect(mockCrud.count).toHaveBeenCalledWith({ isDeleted: false, type: 'product' });
    expect(result).toEqual({ count: 1, rows, total: 1, data: rows });
  });

  // 7. Blog categories count published blog posts via the categories array
  it('should look up published blogposts by the categories array for type=blog', async () => {
    mockCrud.aggregate.mockResolvedValue([]);
    mockCrud.count.mockResolvedValue(0);

    await listCategories({ withCounts: true, type: 'blog' });

    const lookup = mockCrud.aggregate.mock.calls[0][0].find((s) => s.$lookup).$lookup;
    expect(lookup.from).toBe('blogposts');
    expect(lookup.pipeline[0]).toEqual({
      $match: {
        $expr: { $in: ['$$categoryId', { $ifNull: ['$categories', []] }] },
        isDeleted: false,
        isPublished: true,
      },
    });
  });

  // 8. Pages beyond the first add a $skip stage before $limit
  it('should add a $skip stage computed from page and limit', async () => {
    mockCrud.aggregate.mockResolvedValue([]);
    mockCrud.count.mockResolvedValue(0);

    await listCategories({ withCounts: true, page: 3, limit: 5 });

    const pipeline = mockCrud.aggregate.mock.calls[0][0];
    expect(pipeline[2]).toEqual({ $skip: 10 });
    expect(pipeline[3]).toEqual({ $limit: 5 });
  });

  // 9. Invalid page values fall back to page 1 (no $skip)
  it('should treat a non-numeric page as page 1', async () => {
    mockCrud.aggregate.mockResolvedValue([]);
    mockCrud.count.mockResolvedValue(0);

    await listCategories({ withCounts: true, page: 'abc', limit: 5 });

    const pipeline = mockCrud.aggregate.mock.calls[0][0];
    expect(pipeline.some((s) => s.$skip !== undefined)).toBe(false);
    expect(pipeline[2]).toEqual({ $limit: 5 });
  });
});

describe('Categories — getCategoryById', () => {
  // 1. Found category is returned
  it('should return the category when found and not deleted', async () => {
    const category = { _id: CATEGORY_ID, name: 'Wax', isDeleted: false };
    mockCrud.findByPk.mockResolvedValue(category);

    const result = await getCategoryById(CATEGORY_ID);

    expect(mockCrud.findByPk).toHaveBeenCalledWith(CATEGORY_ID);
    expect(result).toBe(category);
  });

  // 2. Missing category → 404
  it('should throw 404 category_not_found when nothing matches', async () => {
    mockCrud.findByPk.mockResolvedValue(null);

    await expect(getCategoryById(CATEGORY_ID)).rejects.toMatchObject({ status: 404, code: 'category_not_found' });
  });

  // 3. Soft-deleted category is treated as missing
  it('should throw 404 when the category is soft-deleted', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: CATEGORY_ID, isDeleted: true });

    await expect(getCategoryById(CATEGORY_ID)).rejects.toMatchObject({ status: 404, code: 'category_not_found' });
  });
});

describe('Categories — getCategoryBySlug', () => {
  // 1. Slug lookup excludes deleted rows
  it('should look up by slug with isDeleted:false and return the document', async () => {
    const doc = { _id: CATEGORY_ID, slug: 'wax' };
    mockCrud.findOne.mockResolvedValue(doc);

    const result = await getCategoryBySlug('wax');

    expect(mockCrud.findOne).toHaveBeenCalledWith({ slug: 'wax', isDeleted: false });
    expect(result).toBe(doc);
  });

  // 2. Unknown slug → 404
  it('should throw 404 category_not_found for an unknown slug', async () => {
    mockCrud.findOne.mockResolvedValue(null);

    await expect(getCategoryBySlug('nope')).rejects.toMatchObject({ status: 404, code: 'category_not_found' });
  });
});

describe('Categories — createCategory', () => {
  // 1. Defaults are applied and the slug is resolved from the name
  it('should resolve the slug, apply defaults and create the category', async () => {
    mockResolveSlug.mockResolvedValue('ceramic');
    mockCrud.create.mockImplementation(async (data) => ({ _id: CATEGORY_ID, ...data }));

    const result = await createCategory(mockReq({ name: 'Ceramic' }));

    expect(mockResolveSlug).toHaveBeenCalledWith('Category', undefined, 'Ceramic');
    expect(mockCrud.create).toHaveBeenCalledWith({
      name: 'Ceramic',
      slug: 'ceramic',
      type: 'product',
      order: 0,
      isActive: true,
    });
    expect(result._id).toBe(CATEGORY_ID);
  });

  // 2. An admin-supplied slug is passed through to resolveSlug
  it('should pass the admin-supplied slug to resolveSlug', async () => {
    mockResolveSlug.mockResolvedValue('custom');
    mockCrud.create.mockResolvedValue({ _id: CATEGORY_ID });

    await createCategory(mockReq({ name: 'Any', slug: 'custom' }));

    expect(mockResolveSlug).toHaveBeenCalledWith('Category', 'custom', 'Any');
  });

  // 3. Explicit values override defaults and description is included when supplied
  it('should keep explicit type/order/isActive/description', async () => {
    mockResolveSlug.mockResolvedValue('blog-cat');
    mockCrud.create.mockResolvedValue({ _id: CATEGORY_ID });

    await createCategory(mockReq({ name: 'Blog Cat', type: 'blog', order: 5, isActive: false, description: 'desc' }));

    expect(mockCrud.create).toHaveBeenCalledWith({
      name: 'Blog Cat', slug: 'blog-cat', type: 'blog', order: 5, isActive: false, description: 'desc',
    });
  });

  // 4. Non-whitelisted body keys never reach the database
  it('should ignore isDeleted and other unknown keys in the body', async () => {
    mockResolveSlug.mockResolvedValue('x');
    mockCrud.create.mockResolvedValue({ _id: CATEGORY_ID });

    await createCategory(mockReq({ name: 'X', isDeleted: true, createdAt: 'hack', slug_hack: 'y' }));

    const data = mockCrud.create.mock.calls[0][0];
    expect(data).not.toHaveProperty('isDeleted');
    expect(data).not.toHaveProperty('createdAt');
    expect(data).not.toHaveProperty('slug_hack');
  });

  // 5. A CREATE audit entry is written for the acting admin
  it('should log a CREATE audit entry with the actor and category id', async () => {
    mockResolveSlug.mockResolvedValue('p');
    mockCrud.create.mockResolvedValue({ _id: CATEGORY_ID });
    const req = mockReq({ name: 'P' });

    await createCategory(req);

    expect(mockActorFromReq).toHaveBeenCalledWith(req);
    expect(mockLogAudit).toHaveBeenCalledWith({
      userId: 'admin-id', ip: '127.0.0.1', action: 'CREATE', resource: 'Category', details: { id: CATEGORY_ID, name: 'P' },
    });
  });
});

describe('Categories — updateCategory', () => {
  const existing = { _id: CATEGORY_ID, name: 'Orig', slug: 'orig', type: 'product', isDeleted: false };

  // 1. Only whitelisted fields reach the database
  it('should update only whitelisted fields (no slug/isDeleted mass-assignment)', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue({ ...existing, name: 'New' });

    const result = await updateCategory(CATEGORY_ID, mockReq({
      name: 'New', type: 'service', order: 2, isActive: false, description: 'd', isDeleted: true, createdAt: 'x',
    }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: CATEGORY_ID },
      { name: 'New', type: 'service', order: 2, isActive: false, description: 'd' },
    );
    expect(mockResolveSlug).not.toHaveBeenCalled();
    expect(result).toEqual({ ...existing, name: 'New' });
  });

  // 2. Missing / deleted category → 404 and no write
  it('should throw 404 and not write when the category is missing or deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...existing, isDeleted: true });

    await expect(updateCategory(CATEGORY_ID, mockReq({ name: 'x' }))).rejects.toMatchObject({ status: 404, code: 'category_not_found' });
    await expect(updateCategory(CATEGORY_ID, mockReq({ name: 'x' }))).rejects.toMatchObject({ status: 404, code: 'category_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 3. Slug is re-resolved only when a slug key is present, using the new name if given
  it('should re-resolve the slug only when req.body.slug is provided', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    mockResolveSlug.mockResolvedValue('renamed');

    await updateCategory(CATEGORY_ID, mockReq({ name: 'Renamed' }));
    expect(mockResolveSlug).not.toHaveBeenCalled();

    await updateCategory(CATEGORY_ID, mockReq({ slug: '', name: 'Renamed' }));
    expect(mockResolveSlug).toHaveBeenCalledWith('Category', '', 'Renamed', CATEGORY_ID);
    expect(mockCrud.findOneAndUpdate).toHaveBeenLastCalledWith({ _id: CATEGORY_ID }, { name: 'Renamed', slug: 'renamed' });
  });

  // 4. Without a new name the slug falls back to the stored name
  it('should fall back to the existing name when re-resolving the slug', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    mockResolveSlug.mockResolvedValue('custom');

    await updateCategory(CATEGORY_ID, mockReq({ slug: 'custom' }));

    expect(mockResolveSlug).toHaveBeenCalledWith('Category', 'custom', 'Orig', CATEGORY_ID);
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: CATEGORY_ID }, { slug: 'custom' });
  });

  // 5. An empty body results in an empty update payload
  it('should write an empty payload when no updatable field is supplied', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateCategory(CATEGORY_ID, mockReq({}));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: CATEGORY_ID }, {});
  });

  // 6. An UPDATE audit entry is written
  it('should log an UPDATE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateCategory(CATEGORY_ID, mockReq({ name: 'x' }));

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', resource: 'Category', details: { id: CATEGORY_ID } }));
  });
});

describe('Categories — deleteCategory', () => {
  // 1. Soft delete: mark deleted and deactivate
  it('should soft-delete the category and deactivate it', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: CATEGORY_ID, isDeleted: false });
    mockCrud.findOneAndUpdate.mockResolvedValue({ _id: CATEGORY_ID, isDeleted: true });

    const result = await deleteCategory(CATEGORY_ID, mockReq());

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: CATEGORY_ID }, { isDeleted: true, isActive: false });
    expect(result).toEqual({ _id: CATEGORY_ID, isDeleted: true });
  });

  // 2. Missing / already-deleted category → 404
  it('should throw 404 when the category is missing or already deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: CATEGORY_ID, isDeleted: true });

    await expect(deleteCategory(CATEGORY_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'category_not_found' });
    await expect(deleteCategory(CATEGORY_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'category_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 3. A DELETE audit entry is written
  it('should log a DELETE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: CATEGORY_ID, isDeleted: false });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await deleteCategory(CATEGORY_ID, mockReq());

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', resource: 'Category', details: { id: CATEGORY_ID } }));
  });
});
