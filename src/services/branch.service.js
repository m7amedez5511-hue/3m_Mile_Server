import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { safeDeleteCloudinaryImage } from '../utils/softDeleteImage.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';

const branchCrud = crudService('Branch');

// whitelist of fields allowed to be updated directly by the client.
// `pin.*` are dotted: Mongo applies them as a nested $set, so moving one half of the
// pin does not rewrite the other.
const UPDATABLE_FIELDS = [
  'name', 'city', 'address', 'phone', 'whatsapp',
  'mapUrl', 'workingHours', 'order', 'isActive',
  'pin.top', 'pin.start',
];

// get paginated list of branches with optional city filter
export const listBranches = async ({ page = 1, limit = 10, city } = {}) => {
  //1 build filter object
  const filter = { isDeleted: false };
  //2 if city filter is provided, add it to the filter object
  if (city) filter.city = { $regex: city, $options: 'i' };
  //3 fetch paginated results sorted by order and createdAt
  return branchCrud.findAndCountAll(filter, { page, limit, sort: { order: 1, createdAt: -1 } });
};

// get a single branch by ID
export const getBranchById = async (id) => {
  //1 fetch the branch by ID
  const branch = await branchCrud.findByPk(id);
  //2 if not found or isDeleted, throw a 404 error
  if (!branch || branch.isDeleted) {
    throw createAppError(404, 'branch_not_found');
  }
  //3 return the fetched branch
  return branch;
};

// create a new branch with optional image upload
export const createBranch = async (req) => {
  //1 extract branch data from request body
  const { name, city, address, phone, whatsapp, lat, lng, mapUrl, workingHours, order, isActive } = req.body;
  const data = {
    name,
    city,
    address,
    phone,
    whatsapp,
    location: { lat, lng },
    mapUrl,
    workingHours,
    // Nested by hand: Mongoose applies dotted paths on update but takes them literally
    // on `create()`, which would store a top-level "pin.top" key.
    pin: {
      top: req.body['pin.top'] ?? '',
      start: req.body['pin.start'] ?? '',
    },
    order: order ?? 0,
    isActive: isActive ?? true,
  };
  //2 if an image was uploaded, add its URL and public ID to the branch data
  if (req.uploadedFile) {
    data.image = req.uploadedFile.url;
    data.imagePublicId = req.uploadedFile.publicId;
  }
  //3 create the branch in the database
  const branch = await branchCrud.create(data);
  //4 log audit for branch creation
  logAudit({ ...actorFromReq(req), action: 'CREATE', resource: 'Branch', details: { id: branch._id, name } });
  //5 return the created branch
  return branch;
};

// update an existing branch by ID with optional image upload
export const updateBranch = async (id, req) => {
  //1 fetch the existing branch by ID
  const existing = await branchCrud.findByPk(id);
  //2 if not found or isDeleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'branch_not_found');
  }
  //3 build update data from a strict whitelist only (prevents mass assignment of isDeleted, imagePublicId, etc.)
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  //4 handle lat/lng separately, merging with existing location if only one is provided
  const { lat, lng } = req.body;
  if (lat !== undefined || lng !== undefined) {
    data.location = { lat: lat ?? existing.location?.lat, lng: lng ?? existing.location?.lng };
  }
  //5 if an image was uploaded, add its URL and public ID to the branch data, and delete the old image from Cloudinary if it exists
  if (req.uploadedFile) {
    data.image = req.uploadedFile.url;
    data.imagePublicId = req.uploadedFile.publicId;
    if (existing.imagePublicId) {
      safeDeleteCloudinaryImage(existing.imagePublicId, { resource: 'Branch', id, reason: 'replaced_on_update' });
    }
  }
  //6 update the branch in the database
  const updated = await branchCrud.findOneAndUpdate({ _id: id }, data);
  //7 log audit for branch update
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'Branch', details: { id } });
  //8 return the updated branch
  return updated;
};

// soft-delete a branch by ID, including its image if it exists
export const deleteBranch = async (id, req) => {
  //1 fetch the existing branch by ID
  const existing = await branchCrud.findByPk(id);
  //2 if not found or already deleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'branch_not_found');
  }
  //3 if the branch has an image, delete it from Cloudinary
  if (existing.imagePublicId) {
    await safeDeleteCloudinaryImage(existing.imagePublicId, { resource: 'Branch', id, reason: 'branch_deleted' });
  }
  //4 soft-delete: mark isDeleted instead of removing the document
  const result = await branchCrud.findOneAndUpdate(
    { _id: id },
    { isDeleted: true, isActive: false, imagePublicId: null }
  );
  //5 log audit for branch deletion
  logAudit({ ...actorFromReq(req), action: 'DELETE', resource: 'Branch', details: { id } });
  //6 return the result of the soft deletion
  return result;
};