import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { slugifyFunction } from '../utils/buildSlugify.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';

const categoryCrud = crudService('Category');

// whitelist of fields allowed to be updated directly by the client
const UPDATABLE_FIELDS = ['name', 'type', 'order', 'isActive'];

// get paginated list of categories with optional search/type filter
export const listCategories = async ({ page = 1, limit = 10, search, type } = {}) => {
  //1 build filter object
  const filter = { isDeleted: false };
  //2 if search filter is provided, add it to the filter object
  if (search) filter.name = { $regex: search, $options: 'i' };
  //3 if type filter is provided, add it to the filter object
  if (type) filter.type = type;
  //4 fetch paginated results sorted by order and createdAt
  return categoryCrud.findAndCountAll(filter, { page, limit, sort: { order: 1, createdAt: -1 } });
};

// get a single category by ID
export const getCategoryById = async (id) => {
  //1 fetch the category by ID
  const category = await categoryCrud.findByPk(id);
  //2 if not found or isDeleted, throw a 404 error
  if (!category || category.isDeleted) {
    throw createAppError(404, 'category_not_found');
  }
  //3 return the fetched category
  return category;
};

// create a new category
export const createCategory = async (req) => {
  //1 extract category data from request body
  const { name, type, order, isActive } = req.body;
  const data = {
    name,
    slug: slugifyFunction(name),
    type: type ?? 'product',
    order: order ?? 0,
    isActive: isActive ?? true,
  };
  //2 create the category in the database
  const category = await categoryCrud.create(data);
  //3 log audit for category creation
  logAudit({ ...actorFromReq(req), action: 'CREATE', resource: 'Category', details: { id: category._id, name } });
  //4 return the created category
  return category;
};

// update an existing category by ID
export const updateCategory = async (id, req) => {
  //1 fetch the existing category by ID
  const existing = await categoryCrud.findByPk(id);
  //2 if not found or isDeleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'category_not_found');
  }
  //3 build update data from a strict whitelist only (prevents mass assignment of isDeleted, slug, etc.)
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  //4 regenerate slug if name is being changed
  if (data.name) data.slug = slugifyFunction(data.name);
  //5 update the category in the database
  const updated = await categoryCrud.findOneAndUpdate({ _id: id }, data);
  //6 log audit for category update
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'Category', details: { id } });
  //7 return the updated category
  return updated;
};

// soft-delete a category by ID
export const deleteCategory = async (id, req) => {
  //1 fetch the existing category by ID
  const existing = await categoryCrud.findByPk(id);
  //2 if not found or already deleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'category_not_found');
  }
  //3 soft-delete: mark isDeleted instead of removing the document
  const result = await categoryCrud.findOneAndUpdate({ _id: id }, { isDeleted: true, isActive: false });
  //4 log audit for category deletion
  logAudit({ ...actorFromReq(req), action: 'DELETE', resource: 'Category', details: { id } });
  //5 return the result of the soft deletion
  return result;
};