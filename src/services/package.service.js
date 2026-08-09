import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { deleteImage as deleteCloudinaryImage } from '../utils/Cloudinary.config.js';
import { slugifyFunction } from '../utils/buildSlugify.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';

const packageCrud = crudService('Package');

export const listPackages = async ({ page = 1, limit = 10, activeOnly } = {}) => {
  const filter = { isDeleted: false };
  if (activeOnly) filter.isActive = true;

  return packageCrud.findAndCountAll(filter, {
    page,
    limit,
    sort: { order: 1, createdAt: -1 },
    populate: [{ path: 'service' }],
  });
};

export const getPackageById = async (id) => {
  const pkg = await packageCrud.findByPk(id, { populate: [{ path: 'service' }] });
  if (!pkg || pkg.isDeleted) {
    throw createAppError(404, 'package_not_found');
  }
  return pkg;
};

export const createPackage = async (req) => {
  const { title, description, service, price, discountPercentage, startDate, endDate, order, isActive } = req.body;
  const data = {
    title,
    slug: slugifyFunction(title),
    description,
    service: service || null,
    price: price ?? null,
    discountPercentage: discountPercentage ?? null,
    startDate: startDate ?? null,
    endDate: endDate ?? null,
    order: order ?? 0,
    isActive: isActive ?? true,
  };

  if (req.uploadedFile) {
    data.image = req.uploadedFile.url;
    data.imagePublicId = req.uploadedFile.publicId;
  }

  const pkg = await packageCrud.create(data);
  logAudit({ ...actorFromReq(req), action: 'CREATE', resource: 'Package', details: { id: pkg._id, title } });
  return pkg;
};

export const updatePackage = async (id, req) => {
  const existing = await packageCrud.findByPk(id);
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'package_not_found');
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

  const updated = await packageCrud.findOneAndUpdate({ _id: id }, data);
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'Package', details: { id } });
  return updated;
};

export const deletePackage = async (id, req) => {
  const existing = await packageCrud.findByPk(id);
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'package_not_found');
  }

  if (existing.imagePublicId) {
    await deleteCloudinaryImage(existing.imagePublicId).catch(() => {});
  }

  const result = await packageCrud.findOneAndDelete({ _id: id });
  logAudit({ ...actorFromReq(req), action: 'DELETE', resource: 'Package', details: { id } });
  return result;
};
