import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { resolveSlug } from '../utils/buildSlugify.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';

const warrantyCrud = crudService('WarrantyGroup');

// whitelist of fields allowed to be updated directly by the client
const UPDATABLE_FIELDS = ['title', 'intro', 'tiers', 'order', 'isActive'];

// get the full list of warranty groups — this is a tabbed page, so it is never paginated
export const listWarrantyGroups = async ({ page = 1, limit = 50, isActive } = {}) => {
  //1 build filter object
  const filter = { isDeleted: false };
  //2 the public page asks for active only; the admin list asks for everything
  if (isActive !== undefined) filter.isActive = isActive;
  //3 fetch results sorted by order and createdAt
  return warrantyCrud.findAndCountAll(filter, { page, limit, sort: { order: 1, createdAt: -1 } });
};

// get a single warranty group by ID
export const getWarrantyGroupById = async (id) => {
  //1 fetch the group by ID
  const group = await warrantyCrud.findByPk(id);
  //2 if not found or isDeleted, throw a 404 error
  if (!group || group.isDeleted) {
    throw createAppError(404, 'warranty_group_not_found');
  }
  //3 return the fetched group
  return group;
};

// create a new warranty group
export const createWarrantyGroup = async (req) => {
  //1 build the document from the validated body
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  //2 resolve the slug — admin-supplied wins, otherwise derived from the title
  data.slug = await resolveSlug('WarrantyGroup', req.body.slug, req.body.title);
  //3 create the group in the database
  const group = await warrantyCrud.create(data);
  //4 log audit for creation
  logAudit({ ...actorFromReq(req), action: 'CREATE', resource: 'WarrantyGroup', details: { id: group._id, title: data.title } });
  //5 return the created group
  return group;
};

// update an existing warranty group by ID
export const updateWarrantyGroup = async (id, req) => {
  //1 fetch the existing group
  const existing = await warrantyCrud.findByPk(id);
  //2 if not found or isDeleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'warranty_group_not_found');
  }
  //3 build update data from a strict whitelist only
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  //4 only re-slug when the admin explicitly changes it
  if (req.body.slug !== undefined) {
    data.slug = await resolveSlug('WarrantyGroup', req.body.slug, req.body.title || existing.title, id);
  }
  //5 update the group in the database
  const updated = await warrantyCrud.findOneAndUpdate({ _id: id }, data);
  //6 log audit for update
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'WarrantyGroup', details: { id } });
  //7 return the updated group
  return updated;
};

// soft-delete a warranty group by ID
export const deleteWarrantyGroup = async (id, req) => {
  //1 fetch the existing group
  const existing = await warrantyCrud.findByPk(id);
  //2 if not found or already deleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'warranty_group_not_found');
  }
  //3 soft-delete: mark isDeleted instead of removing the document
  const result = await warrantyCrud.findOneAndUpdate({ _id: id }, { isDeleted: true, isActive: false });
  //4 log audit for deletion
  logAudit({ ...actorFromReq(req), action: 'DELETE', resource: 'WarrantyGroup', details: { id } });
  //5 return the result of the soft deletion
  return result;
};
