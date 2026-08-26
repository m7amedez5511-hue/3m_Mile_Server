import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listCategories,
  getCategoryById,
  createCategory as createCategoryService,
  updateCategory as updateCategoryService,
  deleteCategory as deleteCategoryService,
  getCategoryBySlug,
} from '../services/category.service.js';

export const getCategories = asyncHandler(async (req, res) => {
  const { page, limit, search, type, withCounts } = req.query;
  const result = await listCategories({
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    search,
    type,
    // Opt-in: the count aggregation is more expensive than the plain list, and only the
    // public sidebars need it.
    withCounts: withCounts === 'true',
  });
  return sendResponse(res, 200, 'categories_fetched', result);
});

export const getCategory = asyncHandler(async (req, res) => {
  const category = await getCategoryById(req.params.id);
  return sendResponse(res, 200, 'category_fetched', category);
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await createCategoryService(req);
  return sendResponse(res, 201, 'category_created', category);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await updateCategoryService(req.params.id, req);
  return sendResponse(res, 200, 'category_updated', category);
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await deleteCategoryService(req.params.id, req);
  return sendResponse(res, 200, 'category_deleted', null);
});

// Controller for fetching a single category by slug — the public site's lookup path
export const getCategoryBySlugHandler = asyncHandler(async (req, res) => {
  //1 call the service to get the category by slug
  const doc = await getCategoryBySlug(req.params.slug);
  //2 send success response with the fetched category
  return sendResponse(res, 200, 'category_fetched', doc);
});
