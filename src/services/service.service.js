import crudService from './crud.service.js';
import { castObjectId } from '../helpers/db.helper.js';
import { createAppError } from '../utils/createAppError.js';
import { safeDeleteCloudinaryImage } from '../utils/softDeleteImage.js';
import { resolveSlug } from '../utils/buildSlugify.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';
import { SERVICE_SLOTS } from '../utils/slotUpload.js';

const serviceCrud = crudService('Service');

// whitelist of fields allowed to be updated directly by the client.
// Images are handled separately via req.uploadedSlots — never from the body, so a
// client cannot point an image slot at an arbitrary URL.
const UPDATABLE_FIELDS = [
  'title', 'heading', 'tagline', 'shortDescription', 'description', 'features', 'enquiry',
  'category', 'order', 'isFeatured', 'isActive',
  'introHeading', 'introBody', 'introPoints', 'primaryCta',
  'benefitsHeading', 'benefits', 'secondaryCta',
];

/** '' means "unset"; omitting the key means "leave alone". Mongoose CastErrors on ''. */
const normaliseRef = (value) => (value === '' || value === undefined ? null : value);

const SINGLE_SLOTS = SERVICE_SLOTS.filter((s) => (s.maxCount || 1) === 1).map((s) => s.name);
const MULTI_SLOTS = SERVICE_SLOTS.filter((s) => (s.maxCount || 1) > 1).map((s) => s.name);

/**
 * Merge uploaded images into the update payload and queue the superseded assets for
 * deletion. Only slots the admin actually uploaded are touched — an update that
 * replaces the hero must leave the collage alone.
 */
const applySlots = (data, req, existing, id) => {
  const slots = req.uploadedSlots;
  if (!slots) return;

  for (const name of SINGLE_SLOTS) {
    if (!slots[name]) continue;
    const previous = existing?.[name]?.publicId;
    data[name] = { url: slots[name].url, publicId: slots[name].publicId, alt: req.body?.[`${name}Alt`] || existing?.[name]?.alt || '' };
    if (previous) {
      safeDeleteCloudinaryImage(previous, { resource: 'Service', id, reason: `${name}_replaced_on_update` });
    }
  }

  for (const name of MULTI_SLOTS) {
    if (!slots[name]) continue;
    const uploaded = Array.isArray(slots[name]) ? slots[name] : [slots[name]];
    data[name] = uploaded.map((f) => ({ url: f.url, publicId: f.publicId, alt: '' }));
    (existing?.[name] || []).forEach((old) =>
      safeDeleteCloudinaryImage(old.publicId, { resource: 'Service', id, reason: `${name}_replaced_on_update` }),
    );
  }
};

/** Every image publicId a service owns, for cleanup on delete. */
const ownedPublicIds = (doc) => [
  ...SINGLE_SLOTS.map((n) => doc?.[n]?.publicId),
  ...MULTI_SLOTS.flatMap((n) => (doc?.[n] || []).map((i) => i.publicId)),
  doc?.imagePublicId,
  ...(doc?.gallery || []).map((g) => g.publicId),
].filter(Boolean);

// get paginated list of services with optional search/category/isFeatured filter
export const listServices = async ({ page = 1, limit = 10, search, category, isFeatured, isActive } = {}) => {
  //1 build filter object
  const filter = { isDeleted: false };
  //2 if search filter is provided, add it to the filter object
  if (search) filter.title = { $regex: search, $options: 'i' };
  //3 if category filter is provided, add it to the filter object
  //  (cast to ObjectId — the populated list goes through aggregation $match, which does no casting)
  if (category) filter.category = castObjectId(category);
  //4 if isFeatured filter is provided, add it to the filter object
  if (isFeatured !== undefined) filter.isFeatured = isFeatured;
  //5 the public site asks for active only; the admin list asks for everything
  if (isActive !== undefined) filter.isActive = isActive;
  //6 fetch paginated results sorted by order and createdAt, populating the linked category
  return serviceCrud.findAndCountAll(filter, { page, limit, sort: { order: 1, createdAt: -1 }, populate: [{ path: 'category' }] });
};

// get a single service by ID
export const getServiceById = async (id) => {
  //1 fetch the service by ID, populating the linked category
  const service = await serviceCrud.findByPk(id, { populate: [{ path: 'category' }] });
  //2 if not found or isDeleted, throw a 404 error
  if (!service || service.isDeleted) {
    throw createAppError(404, 'service_not_found');
  }
  //3 return the fetched service
  return service;
};

/**
 * Get a single service by slug. The public site addresses services by slug, never by
 * ObjectId — without this the frontend would need an id it has no way to know.
 */
export const getServiceBySlug = async (slug) => {
  //1 fetch by slug, populating the linked category
  const service = await serviceCrud.findOne({ slug, isDeleted: false }, { populate: [{ path: 'category' }] });
  //2 if not found, throw a 404 error
  if (!service) {
    throw createAppError(404, 'service_not_found');
  }
  //3 return the fetched service
  return service;
};

// create a new service with optional named image slots
export const createService = async (req) => {
  //1 build the base document from the validated body
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  //2 resolve the slug — admin-supplied wins, otherwise derived from the title
  data.slug = await resolveSlug('Service', req.body.slug, req.body.title);
  data.category = req.body.category || null;
  //3 attach any uploaded images to their named slots
  applySlots(data, req, null, null);
  //4 create the service in the database
  const service = await serviceCrud.create(data);
  //5 log audit for service creation
  logAudit({ ...actorFromReq(req), action: 'CREATE', resource: 'Service', details: { id: service._id, title: data.title } });
  //6 return the created service
  return service;
};

// update an existing service by ID
export const updateService = async (id, req) => {
  //1 fetch the existing service by ID
  const existing = await serviceCrud.findByPk(id);
  //2 if not found or isDeleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'service_not_found');
  }
  //3 build update data from a strict whitelist only (prevents mass assignment of isDeleted, image slots, etc.)
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  if (data.category !== undefined) data.category = normaliseRef(data.category);
  //4 only re-slug when the admin explicitly changes it — retitling must not silently
  // break inbound links to an existing page
  if (req.body.slug !== undefined) {
    data.slug = await resolveSlug('Service', req.body.slug, req.body.title || existing.title, id);
  }
  //5 attach any newly uploaded images, deleting the assets they replace
  applySlots(data, req, existing, id);
  //5a alt text without a new upload — a dotted patch, leaving url/publicId alone.
  //  Slots that were re-uploaded are skipped; applySlots already wrote their alt.
  for (const name of SINGLE_SLOTS) {
    const alt = req.body?.[`${name}Alt`];
    if (alt === undefined || data[name] !== undefined) continue;
    if (!existing?.[name]?.url) continue;
    data[`${name}.alt`] = alt;
  }
  //5b legacy PUT /:id/gallery route — an unnamed array of images landing in the old
  // `gallery` field. Superseded by the named slots above and by GalleryItem, but kept
  // working because it is a documented public endpoint.
  if (req.uploadedFiles?.length) {
    data.gallery = req.uploadedFiles.map((f) => ({ url: f.url, publicId: f.publicId }));
    (existing.gallery || []).forEach((g) =>
      safeDeleteCloudinaryImage(g.publicId, { resource: 'Service', id, reason: 'gallery_replaced_on_update' }),
    );
  }
  //6 update the service in the database
  const updated = await serviceCrud.findOneAndUpdate({ _id: id }, data);
  //7 log audit for service update
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'Service', details: { id } });
  //8 return the updated service
  return updated;
};

// soft-delete a service by ID, including every image it owns on Cloudinary
export const deleteService = async (id, req) => {
  //1 fetch the existing service by ID
  const existing = await serviceCrud.findByPk(id);
  //2 if not found or already deleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'service_not_found');
  }
  //3 remove every owned asset from Cloudinary (named slots, legacy image, legacy gallery)
  await Promise.all(
    ownedPublicIds(existing).map((publicId) =>
      safeDeleteCloudinaryImage(publicId, { resource: 'Service', id, reason: 'service_deleted' }),
    ),
  );
  //4 soft-delete: mark isDeleted instead of removing the document
  const result = await serviceCrud.findOneAndUpdate(
    { _id: id },
    {
      isDeleted: true,
      isActive: false,
      imagePublicId: null,
      gallery: [],
      heroImage: {}, wideImage: {}, gridImage: {}, collage: [],
    },
  );
  //5 log audit for service deletion
  logAudit({ ...actorFromReq(req), action: 'DELETE', resource: 'Service', details: { id } });
  //6 return the result of the soft deletion
  return result;
};
