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
// slotUpload.js pulls in multer/Cloudinary/winston at load time; only the slot table is needed here.
jest.unstable_mockModule('../../utils/slotUpload.js', () => ({
  SERVICE_SLOTS: [
    { name: 'heroImage' },
    { name: 'wideImage' },
    { name: 'gridImage' },
    { name: 'collage', maxCount: 3 },
  ],
}));

const {
  listServices, getServiceById, getServiceBySlug, createService, updateService, deleteService,
} = await import('../../services/service.service.js');

const SERVICE_ID = '64a1f0c2e4b0a1b2c3d4e5f9';
const CATEGORY_ID = '64a1f0c2e4b0a1b2c3d4e5f7';
const mockReq = (body = {}, extra = {}) => ({ body, ip: '127.0.0.1', user: { _id: 'admin-id' }, ...extra });
const slotMeta = (id, name) => ({ resource: 'Service', id, reason: `${name}_replaced_on_update` });

describe('Services — listServices', () => {
  // 1. Default listing filters out soft-deleted rows, sorted by order, category populated
  it('should query non-deleted services sorted by order/createdAt with category populated', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listServices();

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith(
      { isDeleted: false },
      { page: 1, limit: 10, sort: { order: 1, createdAt: -1 }, populate: [{ path: 'category' }] },
    );
  });

  // 2. Search text must be escaped and matched case-insensitively against the title
  it('should add an escaped case-insensitive title regex when search is provided', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listServices({ search: 'ppf [film]+' });

    expect(mockCrud.findAndCountAll).toHaveBeenCalledWith(
      { isDeleted: false, title: { $regex: 'ppf \\[film\\]\\+', $options: 'i' } },
      expect.any(Object),
    );
  });

  // 3. Blank search must not add a title filter
  it('should ignore a blank search string', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listServices({ search: '   ' });

    expect(mockCrud.findAndCountAll.mock.calls[0][0]).toEqual({ isDeleted: false });
  });

  // 4. Category id must be cast to ObjectId for the aggregation $match
  it('should cast the category filter to an ObjectId', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listServices({ category: CATEGORY_ID });

    const filter = mockCrud.findAndCountAll.mock.calls[0][0];
    expect(filter.category).not.toBe(CATEGORY_ID);
    expect(String(filter.category)).toBe(CATEGORY_ID);
  });

  // 5. isFeatured / isActive are only applied when explicitly passed
  it('should apply isFeatured and isActive when provided and skip them when undefined', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listServices({ isFeatured: false, isActive: true });
    await listServices({ isFeatured: undefined, isActive: undefined });

    expect(mockCrud.findAndCountAll.mock.calls[0][0]).toEqual({ isDeleted: false, isFeatured: false, isActive: true });
    expect(mockCrud.findAndCountAll.mock.calls[1][0]).toEqual({ isDeleted: false });
  });

  // 6. Pagination values are forwarded as given
  it('should forward page and limit', async () => {
    mockCrud.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listServices({ page: 2, limit: 40 });

    expect(mockCrud.findAndCountAll.mock.calls[0][1]).toMatchObject({ page: 2, limit: 40 });
  });
});

describe('Services — getServiceById', () => {
  // 1. Found service is returned with category populated
  it('should return the service when found and not deleted', async () => {
    const service = { _id: SERVICE_ID, title: 'PPF', isDeleted: false };
    mockCrud.findByPk.mockResolvedValue(service);

    const result = await getServiceById(SERVICE_ID);

    expect(mockCrud.findByPk).toHaveBeenCalledWith(SERVICE_ID, { populate: [{ path: 'category' }] });
    expect(result).toBe(service);
  });

  // 2. Missing service → 404
  it('should throw 404 service_not_found when nothing matches', async () => {
    mockCrud.findByPk.mockResolvedValue(null);

    await expect(getServiceById(SERVICE_ID)).rejects.toMatchObject({ status: 404, code: 'service_not_found' });
  });

  // 3. Soft-deleted service is treated as missing
  it('should throw 404 when the service is soft-deleted', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: SERVICE_ID, isDeleted: true });

    await expect(getServiceById(SERVICE_ID)).rejects.toMatchObject({ status: 404, code: 'service_not_found' });
  });
});

describe('Services — getServiceBySlug', () => {
  // 1. Slug lookup excludes deleted rows and populates category
  it('should look up by slug with isDeleted:false and return the document', async () => {
    const doc = { _id: SERVICE_ID, slug: 'ppf' };
    mockCrud.findOne.mockResolvedValue(doc);

    const result = await getServiceBySlug('ppf');

    expect(mockCrud.findOne).toHaveBeenCalledWith({ slug: 'ppf', isDeleted: false }, { populate: [{ path: 'category' }] });
    expect(result).toBe(doc);
  });

  // 2. Unknown slug → 404
  it('should throw 404 service_not_found for an unknown slug', async () => {
    mockCrud.findOne.mockResolvedValue(null);

    await expect(getServiceBySlug('nope')).rejects.toMatchObject({ status: 404, code: 'service_not_found' });
  });
});

describe('Services — createService', () => {
  // 1. Whitelisted fields are copied, slug resolved from the title, category defaults to null
  it('should resolve the slug, copy whitelisted fields and create the service', async () => {
    mockResolveSlug.mockResolvedValue('ppf-protection');
    mockCrud.create.mockImplementation(async (data) => ({ _id: SERVICE_ID, ...data }));

    const result = await createService(mockReq({ title: 'PPF Protection', features: ['a', 'b'], order: 2, isFeatured: true }));

    expect(mockResolveSlug).toHaveBeenCalledWith('Service', undefined, 'PPF Protection');
    expect(mockCrud.create).toHaveBeenCalledWith({
      title: 'PPF Protection',
      features: ['a', 'b'],
      order: 2,
      isFeatured: true,
      slug: 'ppf-protection',
      category: null,
    });
    expect(result._id).toBe(SERVICE_ID);
  });

  // 2. An admin-supplied slug is passed through to resolveSlug
  it('should pass the admin-supplied slug to resolveSlug', async () => {
    mockResolveSlug.mockResolvedValue('custom');
    mockCrud.create.mockResolvedValue({ _id: SERVICE_ID });

    await createService(mockReq({ title: 'Any', slug: 'custom' }));

    expect(mockResolveSlug).toHaveBeenCalledWith('Service', 'custom', 'Any');
  });

  // 3. '' category becomes null; a real id is kept
  it("should map category '' to null and keep a real category id", async () => {
    mockResolveSlug.mockResolvedValue('s');
    mockCrud.create.mockResolvedValue({ _id: SERVICE_ID });

    await createService(mockReq({ title: 'S', category: '' }));
    await createService(mockReq({ title: 'S', category: CATEGORY_ID }));

    expect(mockCrud.create.mock.calls[0][0].category).toBeNull();
    expect(mockCrud.create.mock.calls[1][0].category).toBe(CATEGORY_ID);
  });

  // 4. Image slots and other non-whitelisted keys can never be set from the body
  it('should ignore image slots, gallery, isDeleted and slug in the body', async () => {
    mockResolveSlug.mockResolvedValue('s');
    mockCrud.create.mockResolvedValue({ _id: SERVICE_ID });

    await createService(mockReq({
      title: 'S', heroImage: { url: 'https://evil/x' }, collage: [{ url: 'https://evil/y' }],
      gallery: [{ url: 'z' }], image: 'x', imagePublicId: 'p', isDeleted: true,
    }));

    const data = mockCrud.create.mock.calls[0][0];
    for (const key of ['heroImage', 'collage', 'gallery', 'image', 'imagePublicId', 'isDeleted']) {
      expect(data).not.toHaveProperty(key);
    }
  });

  // 5. Uploaded single slots are stored with their alt text; nothing is deleted on create
  it('should attach uploaded single slots with alt from the body (or empty) and delete nothing', async () => {
    mockResolveSlug.mockResolvedValue('s');
    mockCrud.create.mockResolvedValue({ _id: SERVICE_ID });

    await createService(mockReq({ title: 'S', heroImageAlt: 'Hero alt' }, {
      uploadedSlots: {
        heroImage: { url: 'https://cdn/hero.png', publicId: 'hero', width: 1, height: 1 },
        wideImage: { url: 'https://cdn/wide.png', publicId: 'wide', width: 1, height: 1 },
      },
    }));

    const data = mockCrud.create.mock.calls[0][0];
    expect(data.heroImage).toEqual({ url: 'https://cdn/hero.png', publicId: 'hero', alt: 'Hero alt' });
    expect(data.wideImage).toEqual({ url: 'https://cdn/wide.png', publicId: 'wide', alt: '' });
    expect(data).not.toHaveProperty('gridImage');
    expect(data).not.toHaveProperty('collage');
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 6. The collage multi-slot is mapped to {url, publicId, alt:''} entries
  it('should map the collage slot into an array of image objects', async () => {
    mockResolveSlug.mockResolvedValue('s');
    mockCrud.create.mockResolvedValue({ _id: SERVICE_ID });

    await createService(mockReq({ title: 'S' }, {
      uploadedSlots: {
        collage: [
          { url: 'https://cdn/c1.png', publicId: 'c1', width: 1, height: 1 },
          { url: 'https://cdn/c2.png', publicId: 'c2', width: 1, height: 1 },
        ],
      },
    }));

    expect(mockCrud.create.mock.calls[0][0].collage).toEqual([
      { url: 'https://cdn/c1.png', publicId: 'c1', alt: '' },
      { url: 'https://cdn/c2.png', publicId: 'c2', alt: '' },
    ]);
  });

  // 7. Alt text for a slot with no upload is still stored
  it('should store alt-only slots as { alt } when no file was uploaded for them', async () => {
    mockResolveSlug.mockResolvedValue('s');
    mockCrud.create.mockResolvedValue({ _id: SERVICE_ID });

    await createService(mockReq({ title: 'S', gridImageAlt: 'Grid alt', heroImageAlt: 'Hero alt' }, {
      uploadedSlots: { heroImage: { url: 'https://cdn/hero.png', publicId: 'hero' } },
    }));

    const data = mockCrud.create.mock.calls[0][0];
    expect(data.gridImage).toEqual({ alt: 'Grid alt' });
    expect(data.heroImage).toEqual({ url: 'https://cdn/hero.png', publicId: 'hero', alt: 'Hero alt' });
    expect(data).not.toHaveProperty('wideImage');
  });

  // 8. A CREATE audit entry is written for the acting admin
  it('should log a CREATE audit entry with the actor, id and title', async () => {
    mockResolveSlug.mockResolvedValue('s');
    mockCrud.create.mockResolvedValue({ _id: SERVICE_ID });
    const req = mockReq({ title: 'S' });

    await createService(req);

    expect(mockActorFromReq).toHaveBeenCalledWith(req);
    expect(mockLogAudit).toHaveBeenCalledWith({
      userId: 'admin-id', ip: '127.0.0.1', action: 'CREATE', resource: 'Service', details: { id: SERVICE_ID, title: 'S' },
    });
  });
});

describe('Services — updateService', () => {
  const existing = {
    _id: SERVICE_ID, title: 'Orig', slug: 'orig', isDeleted: false,
    heroImage: { url: 'https://cdn/old-hero.png', publicId: 'old-hero', alt: 'Old hero' },
    wideImage: { url: null, publicId: null, alt: '' },
    gridImage: { url: 'https://cdn/old-grid.png', publicId: 'old-grid', alt: '' },
    collage: [{ publicId: 'old-c1' }, { publicId: 'old-c2' }],
    gallery: [],
  };

  // 1. Only whitelisted fields reach the database
  it('should update only whitelisted fields (no slug/isDeleted/image-slot mass-assignment)', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue({ ...existing, title: 'New' });

    const result = await updateService(SERVICE_ID, mockReq({
      title: 'New', heading: 'H', tagline: 'T', shortDescription: 'SD', description: 'D', features: ['f'], enquiry: 'E',
      order: 1, isFeatured: true, isActive: false,
      introHeading: 'IH', introBody: 'IB', introPoints: [{ title: 'a', body: 'b' }], primaryCta: 'P',
      benefitsHeading: 'BH', benefits: [{ title: 'c', body: 'd' }], secondaryCta: 'S',
      isDeleted: true, heroImage: { url: 'https://evil/x' }, collage: [], gallery: [], image: 'x', imagePublicId: 'p', slug_hack: 'y',
    }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: SERVICE_ID }, {
      title: 'New', heading: 'H', tagline: 'T', shortDescription: 'SD', description: 'D', features: ['f'], enquiry: 'E',
      order: 1, isFeatured: true, isActive: false,
      introHeading: 'IH', introBody: 'IB', introPoints: [{ title: 'a', body: 'b' }], primaryCta: 'P',
      benefitsHeading: 'BH', benefits: [{ title: 'c', body: 'd' }], secondaryCta: 'S',
    });
    expect(mockResolveSlug).not.toHaveBeenCalled();
    expect(mockSafeDelete).not.toHaveBeenCalled();
    expect(result).toEqual({ ...existing, title: 'New' });
  });

  // 2. Missing / deleted service → 404 and no write
  it('should throw 404 and not write when the service is missing or deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...existing, isDeleted: true });

    await expect(updateService(SERVICE_ID, mockReq({ title: 'x' }))).rejects.toMatchObject({ status: 404, code: 'service_not_found' });
    await expect(updateService(SERVICE_ID, mockReq({ title: 'x' }))).rejects.toMatchObject({ status: 404, code: 'service_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 3. '' category unsets it (null); a real id is kept; omitted category is untouched
  it("should map category '' to null, keep a real id, and leave it out when omitted", async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateService(SERVICE_ID, mockReq({ category: '' }));
    await updateService(SERVICE_ID, mockReq({ category: CATEGORY_ID }));
    await updateService(SERVICE_ID, mockReq({ title: 'x' }));

    expect(mockCrud.findOneAndUpdate.mock.calls[0][1]).toEqual({ category: null });
    expect(mockCrud.findOneAndUpdate.mock.calls[1][1]).toEqual({ category: CATEGORY_ID });
    expect(mockCrud.findOneAndUpdate.mock.calls[2][1]).toEqual({ title: 'x' });
  });

  // 4. Slug is only re-resolved when a slug key is present in the body
  it('should re-resolve the slug only when req.body.slug is provided', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);
    mockResolveSlug.mockResolvedValue('renamed');

    await updateService(SERVICE_ID, mockReq({ title: 'Renamed' }));
    expect(mockResolveSlug).not.toHaveBeenCalled();

    await updateService(SERVICE_ID, mockReq({ slug: '' }));
    expect(mockResolveSlug).toHaveBeenCalledWith('Service', '', 'Orig', SERVICE_ID);
    expect(mockCrud.findOneAndUpdate).toHaveBeenLastCalledWith({ _id: SERVICE_ID }, { slug: 'renamed' });

    await updateService(SERVICE_ID, mockReq({ slug: 'custom', title: 'Renamed' }));
    expect(mockResolveSlug).toHaveBeenLastCalledWith('Service', 'custom', 'Renamed', SERVICE_ID);
  });

  // 5. Replacing a single slot deletes the previous asset and keeps the old alt unless a new one is sent
  it('should replace an uploaded single slot, delete the old asset and fall back to the stored alt', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateService(SERVICE_ID, mockReq({}, {
      uploadedSlots: { heroImage: { url: 'https://cdn/new-hero.png', publicId: 'new-hero', width: 1, height: 1 } },
    }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: SERVICE_ID }, {
      heroImage: { url: 'https://cdn/new-hero.png', publicId: 'new-hero', alt: 'Old hero' },
    });
    expect(mockSafeDelete).toHaveBeenCalledTimes(1);
    expect(mockSafeDelete).toHaveBeenCalledWith('old-hero', slotMeta(SERVICE_ID, 'heroImage'));
  });

  // 6. Body alt wins over the stored alt for a re-uploaded slot; an empty slot triggers no deletion
  it('should use the body alt for a re-uploaded slot and skip deletion when the slot was empty', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateService(SERVICE_ID, mockReq({ wideImageAlt: 'Wide alt' }, {
      uploadedSlots: { wideImage: { url: 'https://cdn/wide.png', publicId: 'wide' } },
    }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: SERVICE_ID }, {
      wideImage: { url: 'https://cdn/wide.png', publicId: 'wide', alt: 'Wide alt' },
    });
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 7. Replacing the collage deletes every old collage asset and leaves other slots alone
  it('should replace the collage, delete each old collage asset and leave untouched slots alone', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateService(SERVICE_ID, mockReq({}, {
      uploadedSlots: { collage: [{ url: 'https://cdn/c1.png', publicId: 'c1' }, { url: 'https://cdn/c2.png', publicId: 'c2' }, { url: 'https://cdn/c3.png', publicId: 'c3' }] },
    }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: SERVICE_ID }, {
      collage: [
        { url: 'https://cdn/c1.png', publicId: 'c1', alt: '' },
        { url: 'https://cdn/c2.png', publicId: 'c2', alt: '' },
        { url: 'https://cdn/c3.png', publicId: 'c3', alt: '' },
      ],
    });
    expect(mockSafeDelete).toHaveBeenCalledTimes(2);
    expect(mockSafeDelete).toHaveBeenCalledWith('old-c1', slotMeta(SERVICE_ID, 'collage'));
    expect(mockSafeDelete).toHaveBeenCalledWith('old-c2', slotMeta(SERVICE_ID, 'collage'));
    const data = mockCrud.findOneAndUpdate.mock.calls[0][1];
    expect(data).not.toHaveProperty('heroImage');
    expect(data).not.toHaveProperty('gridImage');
  });

  // 8. A single object in a multi slot is wrapped into an array
  it('should wrap a single collage upload into a one-element array', async () => {
    mockCrud.findByPk.mockResolvedValue({ ...existing, collage: [] });
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateService(SERVICE_ID, mockReq({}, { uploadedSlots: { collage: { url: 'https://cdn/c1.png', publicId: 'c1' } } }));

    expect(mockCrud.findOneAndUpdate.mock.calls[0][1].collage).toEqual([{ url: 'https://cdn/c1.png', publicId: 'c1', alt: '' }]);
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 9. Alt text without an upload is a dotted patch that leaves url/publicId alone
  it('should write alt-only changes as dotted paths without touching the image', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateService(SERVICE_ID, mockReq({ heroImageAlt: 'New hero alt', wideImageAlt: 'Wide alt' }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: SERVICE_ID }, {
      'heroImage.alt': 'New hero alt',
      'wideImage.alt': 'Wide alt',
    });
    expect(mockCrud.findOneAndUpdate.mock.calls[0][1]).not.toHaveProperty('heroImage');
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 10. Legacy gallery upload replaces the gallery and deletes the old gallery assets
  it('should replace the legacy gallery from uploadedFiles and delete the old gallery assets', async () => {
    mockCrud.findByPk.mockResolvedValue({ ...existing, gallery: [{ publicId: 'g1' }, { publicId: 'g2' }] });
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateService(SERVICE_ID, mockReq({}, {
      uploadedFiles: [{ url: 'https://cdn/n1.png', publicId: 'n1', width: 1, height: 1 }],
    }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: SERVICE_ID }, {
      gallery: [{ url: 'https://cdn/n1.png', publicId: 'n1' }],
    });
    expect(mockSafeDelete).toHaveBeenCalledTimes(2);
    expect(mockSafeDelete).toHaveBeenCalledWith('g1', { resource: 'Service', id: SERVICE_ID, reason: 'gallery_replaced_on_update' });
    expect(mockSafeDelete).toHaveBeenCalledWith('g2', { resource: 'Service', id: SERVICE_ID, reason: 'gallery_replaced_on_update' });
  });

  // 11. An empty uploadedFiles array does not touch the gallery
  it('should ignore an empty uploadedFiles array', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateService(SERVICE_ID, mockReq({ title: 'x' }, { uploadedFiles: [] }));

    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: SERVICE_ID }, { title: 'x' });
  });

  // 12. An UPDATE audit entry is written
  it('should log an UPDATE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue(existing);
    mockCrud.findOneAndUpdate.mockResolvedValue(existing);

    await updateService(SERVICE_ID, mockReq({ title: 'x' }));

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', resource: 'Service', details: { id: SERVICE_ID } }));
  });
});

describe('Services — deleteService', () => {
  // 1. Soft delete: every owned asset (slots, collage, legacy image, legacy gallery) is removed
  it('should delete every owned asset from Cloudinary and soft-delete the service', async () => {
    mockCrud.findByPk.mockResolvedValue({
      _id: SERVICE_ID, isDeleted: false,
      heroImage: { publicId: 'hero' }, wideImage: { publicId: 'wide' }, gridImage: { publicId: 'grid' },
      collage: [{ publicId: 'c1' }, { publicId: 'c2' }],
      imagePublicId: 'legacy',
      gallery: [{ publicId: 'g1' }],
    });
    mockCrud.findOneAndUpdate.mockResolvedValue({ _id: SERVICE_ID, isDeleted: true });

    const result = await deleteService(SERVICE_ID, mockReq());

    const meta = { resource: 'Service', id: SERVICE_ID, reason: 'service_deleted' };
    expect(mockSafeDelete).toHaveBeenCalledTimes(7);
    for (const id of ['hero', 'wide', 'grid', 'c1', 'c2', 'legacy', 'g1']) {
      expect(mockSafeDelete).toHaveBeenCalledWith(id, meta);
    }
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledWith({ _id: SERVICE_ID }, {
      isDeleted: true, isActive: false, imagePublicId: null, gallery: [],
      heroImage: {}, wideImage: {}, gridImage: {}, collage: [],
    });
    expect(result).toEqual({ _id: SERVICE_ID, isDeleted: true });
  });

  // 2. Empty slots and missing arrays produce no Cloudinary calls
  it('should skip Cloudinary entirely when the service owns no assets', async () => {
    mockCrud.findByPk.mockResolvedValue({
      _id: SERVICE_ID, isDeleted: false,
      heroImage: { url: null, publicId: null }, wideImage: {}, imagePublicId: null,
    });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await deleteService(SERVICE_ID, mockReq());

    expect(mockSafeDelete).not.toHaveBeenCalled();
    expect(mockCrud.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  // 3. Missing / already-deleted service → 404
  it('should throw 404 when the service is missing or already deleted', async () => {
    mockCrud.findByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: SERVICE_ID, isDeleted: true });

    await expect(deleteService(SERVICE_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'service_not_found' });
    await expect(deleteService(SERVICE_ID, mockReq())).rejects.toMatchObject({ status: 404, code: 'service_not_found' });
    expect(mockCrud.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });

  // 4. A DELETE audit entry is written
  it('should log a DELETE audit entry', async () => {
    mockCrud.findByPk.mockResolvedValue({ _id: SERVICE_ID, isDeleted: false });
    mockCrud.findOneAndUpdate.mockResolvedValue({});

    await deleteService(SERVICE_ID, mockReq());

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', resource: 'Service', details: { id: SERVICE_ID } }));
  });
});
