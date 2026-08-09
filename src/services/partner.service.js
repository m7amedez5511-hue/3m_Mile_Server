import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { deleteImage as deleteCloudinaryImage } from '../utils/Cloudinary.config.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';

const partnerCrud = crudService('Partner');

export const listPartners = async ({ page = 1, limit = 50 } = {}) => {
  const filter = { isDeleted: false };
  return partnerCrud.findAndCountAll(filter, { page, limit, sort: { order: 1, createdAt: -1 } });
};

export const getPartnerById = async (id) => {
  const partner = await partnerCrud.findByPk(id);
  if (!partner || partner.isDeleted) {
    throw createAppError(404, 'partner_not_found');
  }
  return partner;
};

export const createPartner = async (req) => {
  if (!req.uploadedFile) {
    throw createAppError(400, 'logo_is_required');
  }

  const { name, order, isActive } = req.body;
  const data = {
    name,
    logo: req.uploadedFile.url,
    logoPublicId: req.uploadedFile.publicId,
    order: order ?? 0,
    isActive: isActive ?? true,
  };

  const partner = await partnerCrud.create(data);
  logAudit({ ...actorFromReq(req), action: 'CREATE', resource: 'Partner', details: { id: partner._id, name } });
  return partner;
};

export const updatePartner = async (id, req) => {
  const existing = await partnerCrud.findByPk(id);
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'partner_not_found');
  }

  const data = { ...req.body };
  if (req.uploadedFile) {
    data.logo = req.uploadedFile.url;
    data.logoPublicId = req.uploadedFile.publicId;
    deleteCloudinaryImage(existing.logoPublicId).catch(() => {});
  }

  const updated = await partnerCrud.findOneAndUpdate({ _id: id }, data);
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'Partner', details: { id } });
  return updated;
};

export const deletePartner = async (id, req) => {
  const existing = await partnerCrud.findByPk(id);
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'partner_not_found');
  }

  await deleteCloudinaryImage(existing.logoPublicId).catch(() => {});

  const result = await partnerCrud.findOneAndDelete({ _id: id });
  logAudit({ ...actorFromReq(req), action: 'DELETE', resource: 'Partner', details: { id } });
  return result;
};
