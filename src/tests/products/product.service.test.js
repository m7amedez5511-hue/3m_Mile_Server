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

const {
  listProducts, getProductById, createProduct, updateProduct, deleteProduct, getProductBySlug,
} = await import('../../services/product.service.js');

const PRODUCT_ID = '64a1f0c2e4b0a1b2c3d4e5f6';
const CATEGORY_ID = '64a1f0c2e4b0a1b2c3d4e5f7';
const mockReq = (body = {}, extra = {}) => ({ body, ip: '127.0.0.1', user: { _id: 'admin-id' }, ...extra });

describe('Products — listProducts', () => {
  // 1. Default listing filters out soft-deleted rows and populates the category
  it('should query non-deleted products sorted newest-first with category populated', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listProducts();

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith(
      { isDeleted: false },
      { page: 1, limit: 10, sort: { createdAt: -1 }, populate: [{ path: 'category' }] },
    );
  });

  // 2. Search text must be escaped and matched case-insensitively
  it('should add an escaped case-insensitive name regex when search is provided', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listProducts({ search: 'nano (x)' });

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith(
      { isDeleted: false, name: { $regex: 'nano \\(x\\)', $options: 'i' } },
      expect.any(Object),
    );
  });

  // 3. Blank search must not add a name filter
  it('should ignore a blank search string', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listProducts({ search: '   ' });

    expect(mockCrud.findAndCountAll.mock.calls[0][0]).toEqual({ isDeleted: false });
  });

  // 4. Category id must be cast to ObjectId for the aggregation $match
  it('should cast the category filter to an ObjectId', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listProducts({ category: CATEGORY_ID });

    const filter = mockCrud.findAndCountAll.mock.calls[0][0];
    expect(filter.category).not.toBe(CATEGORY_ID);
    expect(String(filter.category)).toBe(CATEGORY_ID);
  });

  // 5. isFeatured is only applied when explicitly passed
  it('should apply isFeatured when provided and skip it when undefined', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listProducts({ isFeatured: false });
    await listProducts({ isFeatured: undefined });

    expect(mockCrud.findAndCountAll.mock.calls[0][0]).toEqual({ isDeleted: false, isFeatured: false });
    expect(mockCrud.findAndCountAll.mock.calls[1][0]).toEqual({ isDeleted: false });
  });

  // 6. Pagination values are forwarded as given
  it('should forward page and limit', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listProducts({ page: 3, limit: 25 });

    expect(mockCrud.findAndCountAll.mock.calls[0][1]).toMatchObject({ page: 3, limit: 25 });
  });
});

describe('Products — getProductById', () => {
  // 1. Found product is returned with category populated
  it('should return the product when found and not deleted', async () => {
    const product = { _id: PRODUCT_ID, name: 'Wax', isDeleted: false };
    mockCrud.findByPk.mockResolvedValue(product);

    const result = await getProductById(PRODUCT_ID);

    expect(mockCrud.findByPk).toHaveBeenCalledWith(PRODUCT_ID, { populate: [{ path: 'category' }] });
    expect(result).toBe(product);
  });

  // 2. Missing product → 404
  it('should throw 404 product_not_found when nothing matches', async () => {
    mockCrud.findByPk.mockResolvedValue(null);

    await expect(getProductById(PRODUCT_ID)).rejects.toMatchObject({ status: 404, code: 'product_not_found' });
  });

  // 3. Soft-deleted product is treated as missing
  it('should throw 404 when the product is soft-deleted', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: PRODUCT_ID, isDeleted: true });

    await expect(getProductById(PRODUCT_ID)).rejects.toMatchObject({ status: 404, code: 'product_not_found' });
  });
});

describe('Products — getProductBySlug', () => {
  // 1. Slug lookup excludes deleted rows and populates category
  it('should look up by slug with isDeleted:false and return the document', async () => {
    const doc = { _id: PRODUCT_ID, slug: 'wax' };
    mockCrud.findOne.mockResolvedValue(doc);

    const result = await getProductBySlug('wax');

    expect(mockCrud.findOne).toHaveBeenCalledWith({ slug: 'wax', isDeleted: false }, { populate: [{ path: 'category' }] });
    expect(result).toBe(doc);
  });

  // 2. Unknown slug → 404
  it('should throw 404 product_not_found for an unknown slug', async () => {
    mockCrud.findOne.mockResolvedValue(null);

    await expect(getProductBySlug('nope')).rejects.toMatchObject({ status: 404, code: 'product_not_found' });
  });
});

describe('Products — createProduct', () => {
  // 1. Defaults are applied and the slug is resolved from the name
  it('should resolve the slug, apply defaults and create the product', async () => {
    mockResolveSlug.mockResolvedValue('ceramic-coating');
    mockCrud.create.mockImplementation(async (data) => ({ _id: PRODUCT_ID, ...data }));

    const result = await createProduct(mockReq({ name: 'Ceramic Coating' }));

    expect(mockResolveSlug).toHaveBeenCalledWith('Product', undefined, 'Ceramic Coating');
    expect(mockCrud.create).toHaveBeenCalledWith({
      name: 'Ceramic Coating',
      slug: 'ceramic-coating',
      excerpt: undefined,
      shortDescription: undefined,
      description: undefined,
      price: undefined,
      compareAtPrice: null,
      sku: null,
      category: null,
      stock: 0,
      isFeatured: false,
      isActive: true,
    });
    expect(result._id).toBe(PRODUCT_ID);
  });

  // 2. An admin-supplied slug is passed through to resolveSlug
  it('should pass the admin-supplied slug to resolveSlug', async () => {
    mockResolveSlug.mockResolvedValue('custom');
    mockCrud.create.mockResolvedValue({ _id: PRODUCT_ID });

    await createProduct(mockReq({ name: 'Any', slug: 'custom' }));

    expect(mockResolveSlug).toHaveBeenCalledWith('Product', 'custom', 'Any');
  });

  // 3. Uploaded files are mapped to {url, publicId}
  it('should map uploadedFiles into the images array', async () => {
    mockResolveSlug.mockResolvedValue('img');
    mockCrud.create.mockResolvedValue({ _id: PRODUCT_ID });
    const uploadedFiles = [
      { url: 'https://cdn/a.png', publicId: 'a', width: 1, height: 1 },
      { url: 'https://cdn/b.png', publicId: 'b', width: 1, height: 1 },
    ];

    await createProduct(mockReq({ name: 'Img' }, { uploadedFiles }));

    expect(mockCrud.create.mock.calls[0][0].images).toEqual([
      { url: 'https://cdn/a.png', publicId: 'a' },
      { url: 'https://cdn/b.png', publicId: 'b' },
    ]);
  });

  // 4. Explicit values override defaults
  it('should keep explicit price/compareAtPrice/sku/category/stock/flags', async () => {
    mockResolveSlug.mockResolvedValue('p');
    mockCrud.create.mockResolvedValue({ _id: PRODUCT_ID });

    await createProduct(mockReq({
      name: 'P', price: 100, compareAtPrice: 150, sku: 'SKU-1', category: CATEGORY_ID, stock: 7, isFeatured: true, isActive: false,
    }));

    expect(mockCrud.create.mock.calls[0][0]).toMatchObject({
      price: 100, compareAtPrice: 150, sku: 'SKU-1', category: CATEGORY_ID, stock: 7, isFeatured: true, isActive: false,
    });
  });

  // 5. A CREATE audit entry is written for the acting admin
  it('should log a CREATE audit entry with the actor and product id', async () => {
    mockResolveSlug.mockResolvedValue('p');
    mockCrud.create.mockResolvedValue({ _id: PRODUCT_ID });
    const req = mockReq({ name: 'P' });

    await createProduct(req);

    expect(mockActorFromReq).toHaveBeenCalledWith(req);
    expect(mockLogAudit).toHaveBeenCalledWith({
      userId: 'admin-id', ip: '127.0.0.1', action: 'CREATE', resource: 'Product', details: { id: PRODUCT_ID, name: 'P' },
    });
  });
});

describe('Products — updateProduct', () => {
  const existing = { _id: PRODUCT_ID, name: 'Orig', slug: 'orig', price: 100, compareAtPrice: null, isDeleted: false, images: [] };

  // 1. Only whitelisted fields reach the database
  it('should update only whitelisted fields (no slug/isDeleted/images mass-assignment)', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue({ ...existing, name: 'New' });

    await updateProduct(PRODUCT_ID, mockReq({ name: 'New', price: 20, isDeleted: true, images: [{ url: 'x' }], slug_hack: 'y' }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: PRODUCT_ID }, { name: 'New', price: 20 });
    expect(mockResolveSlug).not.toHaveBeenCalled();
  });

  // 2. Missing / deleted product → 404 and no write
  it('should throw 404 and not write when the product is missing or deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...existing, isDeleted: true });

    await expect(updateProduct(PRODUCT_ID, mockReq({ name: 'x' }))).rejects.toMatchObject({ status: 404, code: 'product_not_found' });
    await expect(updateProduct(PRODUCT_ID, mockReq({ name: 'x' }))).rejects.toMatchObject({ status: 404, code: 'product_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 3. compareAtPrice must exceed the effective price (falls back to stored values)
  it('should reject when the effective compareAtPrice is not above the effective price', async () => {
    mockCrud.findByPk.mockResolvedValue({ ...existing, price: 100, compareAtPrice: 150 });

    await expect(updateProduct(PRODUCT_ID, mockReq({ price: 200 })))
      .rejects.toMatchObject({ status: 400, code: 'compare_at_price_must_exceed_price' });
    await expect(updateProduct(PRODUCT_ID, mockReq({ compareAtPrice: 50 })))
      .rejects.toMatchObject({ status: 400, code: 'compare_at_price_must_exceed_price' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 4. Clearing compareAtPrice with null is allowed
  it('should allow compareAtPrice to be cleared with null', async () => {
    mockCrud.findByPk.mockResolvedValue({ ...existing, compareAtPrice: 150 });
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateProduct(PRODUCT_ID, mockReq({ compareAtPrice: null }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: PRODUCT_ID }, { compareAtPrice: null });
  });

  // 5. Slug is only re-resolved when a slug key is present in the body
  it('should re-resolve the slug only when req.body.slug is provided', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    mockResolveSlug.mockResolvedValue('renamed');

    await updateProduct(PRODUCT_ID, mockReq({ name: 'Renamed' }));
    expect(mockResolveSlug).not.toHaveBeenCalled();

    await updateProduct(PRODUCT_ID, mockReq({ slug: '' }));
    expect(mockResolveSlug).toHaveBeenCalledWith('Product', '', 'Orig', PRODUCT_ID);
    expect(mockCrud.findOneAndUpdate).toHaveBeenLastCalledWith({ _id: PRODUCT_ID }, { slug: 'renamed' });
  });

  // 6. '' category unsets it (null); omitted category is untouched
  it("should map category '' to null and leave it out when omitted", async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateProduct(PRODUCT_ID, mockReq({ category: '' }));
    await updateProduct(PRODUCT_ID, mockReq({ name: 'x' }));

    expect(mockCrud.findOneAndUpdate.mock.calls[0][1]).toEqual({ category: null });
    expect(mockCrud.findOneAndUpdate.mock.calls[1][1]).toEqual({ name: 'x' });
  });

  // 7. New uploads replace the images array and old assets are deleted from Cloudinary
  it('should replace images and delete every old asset from Cloudinary', async () => {
    mockCrud.findByPk.mockResolvedValue({ ...existing, images: [{ publicId: 'old1' }, { publicId: 'old2' }] });
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateProduct(PRODUCT_ID, mockReq({}, { uploadedFiles: [{ url: 'https://cdn/new.png', publicId: 'new' }] }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: PRODUCT_ID }, { images: [{ url: 'https://cdn/new.png', publicId: 'new' }] });
    expect(mockSafeDelete).toHaveBeenCalledTimes(2);
    expect(mockSafeDelete).toHaveBeenCalledWith('old1', { resource: 'Product', id: PRODUCT_ID, reason: 'replaced_on_update' });
    expect(mockSafeDelete).toHaveBeenCalledWith('old2', { resource: 'Product', id: PRODUCT_ID, reason: 'replaced_on_update' });
  });

  // 8. An UPDATE audit entry is written
  it('should log an UPDATE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateProduct(PRODUCT_ID, mockReq({ name: 'x' }));

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', resource: 'Product', details: { id: PRODUCT_ID } }));
  });
});

describe('Products — deleteProduct', () => {
  // 1. Soft delete: mark deleted, deactivate, clear images, remove assets
  it('should soft-delete the product and delete its images from Cloudinary', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: PRODUCT_ID, isDeleted: false, images: [{ publicId: 'a' }, { publicId: 'b' }] });
    mockCrud.findOneAndUpdate.mockResolvedValue({ _id: PRODUCT_ID, isDeleted: true });

    const result = await deleteProduct(PRODUCT_ID, mockReq());

    expect(mockSafeDelete).toHaveBeenCalledWith('a', { resource: 'Product', id: PRODUCT_ID, reason: 'product_deleted' });
    expect(mockSafeDelete).toHaveBeenCalledWith('b', { resource: 'Product', id: PRODUCT_ID, reason: 'product_deleted' });
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: PRODUCT_ID }, { isDeleted: true, isActive: false, images: [] });
    expect(result).toEqual({ _id: PRODUCT_ID, isDeleted: true });
  });

  // 2. Missing / already-deleted product → 404
  it('should throw 404 when the product is missing or already deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: PRODUCT_ID, isDeleted: true });

    await expect(deleteProduct(PRODUCT_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'product_not_found' });
    await expect(deleteProduct(PRODUCT_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'product_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 3. A DELETE audit entry is written
  it('should log a DELETE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: PRODUCT_ID, isDeleted: false, images: [] });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await deleteProduct(PRODUCT_ID, mockReq());

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', resource: 'Product', details: { id: PRODUCT_ID } }));
  });
});
