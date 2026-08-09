import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { safeDeleteCloudinaryImage } from '../utils/softDeleteImage.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';

const partnerCrud = crudService('Partner');

// whitelist of fields allowed to be updated directly by the client (logo handled separately via uploadedFile)
const UPDATABLE_FIELDS = ['name', 'order', 'isActive'];

// get paginated list of partners
export const listPartners = async ({ page = 1, limit = 50 } = {}) => {
  //1 build filter object
  const filter = { isDeleted: false };
  //2 fetch paginated results sorted by order and createdAt
  return partnerCrud.findAndCountAll(filter, { page, limit, sort: { order: 1, createdAt: -1 } });
};

// get a single partner by ID
export const getPartnerById = async (id) => {
  //1 fetch the partner by ID
  const partner = await partnerCrud.findByPk(id);
  //2 if not found or isDeleted, throw a 404 error
  if (!partner || partner.isDeleted) {
    throw createAppError(404, 'partner_not_found');
  }
  //3 return the fetched partner
  return partner;
};

// create a new partner (logo is required)
export const createPartner = async (req) => {
  //1 the logo is required for every partner
  if (!req.uploadedFile) {
    throw createAppError(400, 'logo_is_required');
  }
  //2 extract partner data from request body
  const { name, order, isActive } = req.body;
  const data = {
    name,
    logo: req.uploadedFile.url,
    logoPublicId: req.uploadedFile.publicId,
    order: order ?? 0,
    isActive: isActive ?? true,
  };
  //3 create the partner in the database
  const partner = await partnerCrud.create(data);
  //4 log audit for partner creation
  logAudit({ ...actorFromReq(req), action: 'CREATE', resource: 'Partner', details: { id: partner._id, name } });
  //5 return the created partner
  return partner;
};

// update an existing partner by ID with optional logo replacement
export const updatePartner = async (id, req) => {
  //1 fetch the existing partner by ID
  const existing = await partnerCrud.findByPk(id);
  //2 if not found or isDeleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'partner_not_found');
  }
  //3 build update data from a strict whitelist only (prevents mass assignment of isDeleted, logoPublicId, etc.)
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  //4 if a new logo was uploaded, replace it and delete the old one from Cloudinary
  if (req.uploadedFile) {
    data.logo = req.uploadedFile.url;
    data.logoPublicId = req.uploadedFile.publicId;
    safeDeleteCloudinaryImage(existing.logoPublicId, { resource: 'Partner', id, reason: 'replaced_on_update' });
  }
  //5 update the partner in the database
  const updated = await partnerCrud.findOneAndUpdate({ _id: id }, data);
  //6 log audit for partner update
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'Partner', details: { id } });
  //7 return the updated partner
  return updated;
};

// soft-delete a partner by ID, including its logo on Cloudinary
export const deletePartner = async (id, req) => {
  //1 fetch the existing partner by ID
  const existing = await partnerCrud.findByPk(id);
  //2 if not found or already deleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'partner_not_found');
  }
  //3 delete the logo from Cloudinary
  await safeDeleteCloudinaryImage(existing.logoPublicId, { resource: 'Partner', id, reason: 'partner_deleted' });
  //4 soft-delete: mark isDeleted instead of removing the document (logo/logoPublicId kept as-is since the field is required by schema)
  const result = await partnerCrud.findOneAndUpdate({ _id: id }, { isDeleted: true, isActive: false });
  //5 log audit for partner deletion
  logAudit({ ...actorFromReq(req), action: 'DELETE', resource: 'Partner', details: { id } });
  //6 return the result of the soft deletion
  return result;
};