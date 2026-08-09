import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { safeDeleteCloudinaryImage } from '../utils/softDeleteImage.js';
import { slugifyFunction } from '../utils/buildSlugify.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';

const serviceCrud = crudService('Service');

// whitelist of fields allowed to be updated directly by the client (image/gallery handled separately via uploadedFile(s))
const UPDATABLE_FIELDS = [
  'title', 'shortDescription', 'description', 'features',
  'category', 'order', 'isFeatured', 'isActive',
];

// get paginated list of services with optional search/category/isFeatured filter
export const listServices = async ({ page = 1, limit = 10, search, category, isFeatured } = {}) => {
  //1 build filter object
  const filter = { isDeleted: false };
  //2 if search filter is provided, add it to the filter object
  if (search) filter.title = { $regex: search, $options: 'i' };
  //3 if category filter is provided, add it to the filter object
  if (category) filter.category = category;
  //4 if isFeatured filter is provided, add it to the filter object
  if (isFeatured !== undefined) filter.isFeatured = isFeatured;
  //5 fetch paginated results sorted by order and createdAt, populating the linked category
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

// create a new service with optional cover image and gallery upload
export const createService = async (req) => {
  //1 extract service data from request body
  const { title, shortDescription, description, features, category, order, isFeatured, isActive } = req.body;
  const data = {
    title,
    slug: slugifyFunction(title),
    shortDescription,
    description,
    features,
    category: category || null,
    order: order ?? 0,
    isFeatured: isFeatured ?? false,
    isActive: isActive ?? true,
  };
  //2 if a cover image was uploaded, add its URL and public ID to the service data
  if (req.uploadedFile) {
    data.image = req.uploadedFile.url;
    data.imagePublicId = req.uploadedFile.publicId;
  }
  //3 if gallery images were uploaded, map them to the gallery array
  if (req.uploadedFiles?.length) {
    data.gallery = req.uploadedFiles.map((f) => ({ url: f.url, publicId: f.publicId }));
  }
  //4 create the service in the database
  const service = await serviceCrud.create(data);
  //5 log audit for service creation
  logAudit({ ...actorFromReq(req), action: 'CREATE', resource: 'Service', details: { id: service._id, title } });
  //6 return the created service
  return service;
};

// update an existing service by ID — covers both the main metadata/cover-image
// update route and the separate /:id/gallery route (gallery-only, no body fields)
export const updateService = async (id, req) => {
  //1 fetch the existing service by ID
  const existing = await serviceCrud.findByPk(id);
  //2 if not found or isDeleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'service_not_found');
  }
  //3 build update data from a strict whitelist only (prevents mass assignment of slug, isDeleted, image, gallery, etc.)
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  //4 regenerate slug if title is being changed
  if (data.title) data.slug = slugifyFunction(data.title);
  //5 if a new cover image was uploaded, replace it and delete the old one from Cloudinary
  if (req.uploadedFile) {
    data.image = req.uploadedFile.url;
    data.imagePublicId = req.uploadedFile.publicId;
    if (existing.imagePublicId) {
      safeDeleteCloudinaryImage(existing.imagePublicId, { resource: 'Service', id, reason: 'replaced_on_update' });
    }
  }
  //6 if new gallery images were uploaded, replace the array and delete all old gallery assets from Cloudinary
  if (req.uploadedFiles?.length) {
    data.gallery = req.uploadedFiles.map((f) => ({ url: f.url, publicId: f.publicId }));
    (existing.gallery || []).forEach((g) =>
      safeDeleteCloudinaryImage(g.publicId, { resource: 'Service', id, reason: 'gallery_replaced_on_update' }),
    );
  }
  //7 update the service in the database
  const updated = await serviceCrud.findOneAndUpdate({ _id: id }, data);
  //8 log audit for service update
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'Service', details: { id } });
  //9 return the updated service
  return updated;
};

// soft-delete a service by ID, including its cover image and gallery on Cloudinary
export const deleteService = async (id, req) => {
  //1 fetch the existing service by ID
  const existing = await serviceCrud.findByPk(id);
  //2 if not found or already deleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'service_not_found');
  }
  //3 if the service has a cover image, delete it from Cloudinary
  if (existing.imagePublicId) {
    await safeDeleteCloudinaryImage(existing.imagePublicId, { resource: 'Service', id, reason: 'service_deleted' });
  }
  //4 delete all gallery images from Cloudinary
  await Promise.all(
    (existing.gallery || []).map((g) =>
      safeDeleteCloudinaryImage(g.publicId, { resource: 'Service', id, reason: 'service_deleted' }),
    ),
  );
  //5 soft-delete: mark isDeleted instead of removing the document
  const result = await serviceCrud.findOneAndUpdate(
    { _id: id },
    { isDeleted: true, isActive: false, imagePublicId: null, gallery: [] }
  );
  //6 log audit for service deletion
  logAudit({ ...actorFromReq(req), action: 'DELETE', resource: 'Service', details: { id } });
  //7 return the result of the soft deletion
  return result;
};