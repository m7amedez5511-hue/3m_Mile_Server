import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { safeDeleteCloudinaryImage } from '../utils/softDeleteImage.js';
import { resolveSlug } from '../utils/buildSlugify.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';

const packageCrud = crudService('Package');

// whitelist of fields allowed to be updated directly by the client
const UPDATABLE_FIELDS = [
  'title', 'description', 'service', 'price', 'discountPercentage',
  'startDate', 'endDate', 'order', 'isActive',
];

// get paginated list of packages with optional active-only filter
export const listPackages = async ({ page = 1, limit = 10, activeOnly } = {}) => {
  //1 build filter object
  const filter = { isDeleted: false };
  //2 if activeOnly filter is provided, restrict to active packages
  if (activeOnly) filter.isActive = true;
  //3 fetch paginated results sorted by order and createdAt, populating the linked service
  return packageCrud.findAndCountAll(filter, { page, limit, sort: { order: 1, createdAt: -1 }, populate: [{ path: 'service' }] });
};

// get a single package by ID
export const getPackageById = async (id) => {
  //1 fetch the package by ID, populating the linked service
  const pkg = await packageCrud.findByPk(id, { populate: [{ path: 'service' }] });
  //2 if not found or isDeleted, throw a 404 error
  if (!pkg || pkg.isDeleted) {
    throw createAppError(404, 'package_not_found');
  }
  //3 return the fetched package
  return pkg;
};

// create a new package with optional image upload
export const createPackage = async (req) => {
  //1 extract package data from request body
  const { title, description, service, price, discountPercentage, startDate, endDate, order, isActive } = req.body;
  const data = {
    title,
    slug: await resolveSlug('Package', req.body.slug, title),
    description,
    service: service || null,
    price: price ?? null,
    discountPercentage: discountPercentage ?? null,
    startDate: startDate ?? null,
    endDate: endDate ?? null,
    order: order ?? 0,
    isActive: isActive ?? true,
  };
  //2 if an image was uploaded, add its URL and public ID to the package data
  if (req.uploadedFile) {
    data.image = req.uploadedFile.url;
    data.imagePublicId = req.uploadedFile.publicId;
  }
  //3 create the package in the database
  const pkg = await packageCrud.create(data);
  //4 log audit for package creation
  logAudit({ ...actorFromReq(req), action: 'CREATE', resource: 'Package', details: { id: pkg._id, title } });
  //5 return the created package
  return pkg;
};

// update an existing package by ID with optional image upload
export const updatePackage = async (id, req) => {
  //1 fetch the existing package by ID
  const existing = await packageCrud.findByPk(id);
  //2 if not found or isDeleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'package_not_found');
  }
  //3 build update data from a strict whitelist only (prevents mass assignment of slug, isDeleted, imagePublicId, etc.)
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  // '' means "unlink"; omitting the key means "leave alone". Mongoose CastErrors on ''.
  if (data.service !== undefined) data.service = data.service || null;
  //4 regenerate slug if title is being changed
  if (req.body.slug !== undefined) {
    data.slug = await resolveSlug('Package', req.body.slug, req.body.title || existing.title, id);
  }
  //5 if an image was uploaded, add its URL and public ID to the package data, and delete the old image from Cloudinary if it exists
  if (req.uploadedFile) {
    data.image = req.uploadedFile.url;
    data.imagePublicId = req.uploadedFile.publicId;
    if (existing.imagePublicId) {
      safeDeleteCloudinaryImage(existing.imagePublicId, { resource: 'Package', id, reason: 'replaced_on_update' });
    }
  }
  //6 update the package in the database
  const updated = await packageCrud.findOneAndUpdate({ _id: id }, data);
  //7 log audit for package update
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'Package', details: { id } });
  //8 return the updated package
  return updated;
};

// soft-delete a package by ID, including its image if it exists
export const deletePackage = async (id, req) => {
  //1 fetch the existing package by ID
  const existing = await packageCrud.findByPk(id);
  //2 if not found or already deleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'package_not_found');
  }
  //3 if the package has an image, delete it from Cloudinary
  if (existing.imagePublicId) {
    await safeDeleteCloudinaryImage(existing.imagePublicId, { resource: 'Package', id, reason: 'package_deleted' });
  }
  //4 soft-delete: mark isDeleted instead of removing the document
  const result = await packageCrud.findOneAndUpdate(
    { _id: id },
    { isDeleted: true, isActive: false, imagePublicId: null }
  );
  //5 log audit for package deletion
  logAudit({ ...actorFromReq(req), action: 'DELETE', resource: 'Package', details: { id } });
  //6 return the result of the soft deletion
  return result;
};

/** Get a single package by slug — the public site addresses it by slug, not id. */
export const getPackageBySlug = async (slug) => {
  //1 fetch by slug
  const doc = await packageCrud.findOne({ slug, isDeleted: false }, { populate: [{ path: 'service' }] });
  //2 if not found, throw a 404 error
  if (!doc) {
    throw createAppError(404, 'package_not_found');
  }
  //3 return the document
  return doc;
};
