import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { deleteImage as deleteCloudinaryImage } from '../utils/Cloudinary.config.js';
import { slugifyFunction } from '../utils/buildSlugify.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';

const serviceCrud = crudService('Service');

export const listServices = async ({ page = 1, limit = 10, search, category, isFeatured } = {}) => {
  const filter = { isDeleted: false };
  if (search) filter.title = { $regex: search, $options: 'i' };
  if (category) filter.category = category;
  if (isFeatured !== undefined) filter.isFeatured = isFeatured;

  return serviceCrud.findAndCountAll(filter, {
    page,
    limit,
    sort: { order: 1, createdAt: -1 },
    populate: [{ path: 'category' }],
  });
};

export const getServiceById = async (id) => {
  const service = await serviceCrud.findByPk(id, { populate: [{ path: 'category' }] });
  if (!service || service.isDeleted) {
    throw createAppError(404, 'service_not_found');
  }
  return service;
};

export const createService = async (req) => {
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

  if (req.uploadedFile) {
    data.image = req.uploadedFile.url;
    data.imagePublicId = req.uploadedFile.publicId;
  }

  if (req.uploadedFiles?.length) {
    data.gallery = req.uploadedFiles.map((f) => ({ url: f.url, publicId: f.publicId }));
  }

  const service = await serviceCrud.create(data);
  logAudit({ ...actorFromReq(req), action: 'CREATE', resource: 'Service', details: { id: service._id, title } });
  return service;
};

export const updateService = async (id, req) => {
  const existing = await serviceCrud.findByPk(id);
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'service_not_found');
  }

  const data = { ...req.body };
  if (data.title) data.slug = slugifyFunction(data.title);

  if (req.uploadedFile) {
    data.image = req.uploadedFile.url;
    data.imagePublicId = req.uploadedFile.publicId;
    if (existing.imagePublicId) {
      deleteCloudinaryImage(existing.imagePublicId).catch(() => {});
    }
  }

  if (req.uploadedFiles?.length) {
    data.gallery = req.uploadedFiles.map((f) => ({ url: f.url, publicId: f.publicId }));
    // old gallery assets are replaced — clean them up from Cloudinary
    (existing.gallery || []).forEach((g) => deleteCloudinaryImage(g.publicId).catch(() => {}));
  }

  const updated = await serviceCrud.findOneAndUpdate({ _id: id }, data);
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'Service', details: { id } });
  return updated;
};

export const deleteService = async (id, req) => {
  const existing = await serviceCrud.findByPk(id);
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'service_not_found');
  }

  if (existing.imagePublicId) {
    await deleteCloudinaryImage(existing.imagePublicId).catch(() => {});
  }
  (existing.gallery || []).forEach((g) => deleteCloudinaryImage(g.publicId).catch(() => {}));

  const result = await serviceCrud.findOneAndDelete({ _id: id });
  logAudit({ ...actorFromReq(req), action: 'DELETE', resource: 'Service', details: { id } });
  return result;
};
