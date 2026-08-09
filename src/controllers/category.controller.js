import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listCategories,
  getCategoryById,
  createCategory as createCategoryService,
  updateCategory as updateCategoryService,
  deleteCategory as deleteCategoryService,
} from '../services/category.service.js';

export const getCategories = asyncHandler(async (req, res) => {
  const { page, limit, search } = req.query;
  const result = await listCategories({
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    search,
  });
  return sendResponse(res, 200, 'categories_fetched', result);
});

export const getCategory = asyncHandler(async (req, res) => {
  const category = await getCategoryById(req.params.id);
  return sendResponse(res, 200, 'category_fetched', category);
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await createCategoryService(req.body, req.uploadedFile);
  return sendResponse(res, 201, 'category_created', category);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await updateCategoryService(req.params.id, req.body, req.uploadedFile);
  return sendResponse(res, 200, 'category_updated', category);
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await deleteCategoryService(req.params.id);
  return sendResponse(res, 200, 'category_deleted', null);
});