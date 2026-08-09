import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listProducts,
  getProductById,
  createProduct as createProductService,
  updateProduct as updateProductService,
  deleteProduct as deleteProductService,
} from '../services/product.service.js';

// Controller for fetching a paginated list of products
export const getProducts = asyncHandler(async (req, res) => {
  //1 extract pagination and filter parameters from query
  const { page, limit, search, category, isFeatured } = req.query;
  //2 call the service to get the list of products with pagination and optional filters
  const result = await listProducts({
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    search,
    category,
    isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
  });
  //3 send success response with the paginated list of products
  return sendResponse(res, 200, 'products_fetched', result);
});

// Controller for fetching a single product by ID
export const getProduct = asyncHandler(async (req, res) => {
  //1 call the service to get the product by ID
  const product = await getProductById(req.params.id);
  //2 send success response with the fetched product
  return sendResponse(res, 200, 'product_fetched', product);
});

// Controller for creating a new product
export const createProduct = asyncHandler(async (req, res) => {
  //1 call the service to create a new product with the request data
  const product = await createProductService(req);
  //2 send success response with the created product
  return sendResponse(res, 201, 'product_created', product);
});

// Controller for updating an existing product by ID
export const updateProduct = asyncHandler(async (req, res) => {
  //1 call the service to update the product with the request data
  const product = await updateProductService(req.params.id, req);
  //2 send success response with the updated product
  return sendResponse(res, 200, 'product_updated', product);
});

// Controller for deleting a product by ID
export const deleteProduct = asyncHandler(async (req, res) => {
  //1 call the service to delete the product by ID
  await deleteProductService(req.params.id, req);
  //2 send success response indicating the product was deleted
  return sendResponse(res, 200, 'product_deleted', null);
});