import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listProducts,
  getProductById,
  createProduct as createProductService,
  updateProduct as updateProductService,
  deleteProduct as deleteProductService,
} from '../services/product.service.js';

export const getProducts = asyncHandler(async (req, res) => {
  const { page, limit, search, category, isFeatured } = req.query;
  const result = await listProducts({
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    search,
    category,
    isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
  });
  return sendResponse(res, 200, 'products_fetched', result);
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await getProductById(req.params.id);
  return sendResponse(res, 200, 'product_fetched', product);
});

export const createProduct = asyncHandler(async (req, res) => {
  const product = await createProductService(req);
  return sendResponse(res, 201, 'product_created', product);
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await updateProductService(req.params.id, req);
  return sendResponse(res, 200, 'product_updated', product);
});

export const deleteProduct = asyncHandler(async (req, res) => {
  await deleteProductService(req.params.id, req);
  return sendResponse(res, 200, 'product_deleted', null);
});
