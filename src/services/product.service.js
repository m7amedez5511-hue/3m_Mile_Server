import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { safeDeleteCloudinaryImage } from '../utils/softDeleteImage.js';
import { slugifyFunction } from '../utils/buildSlugify.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';

const productCrud = crudService('Product');

// whitelist of fields allowed to be updated directly by the client (images handled separately via uploadedFiles)
const UPDATABLE_FIELDS = [
  'name', 'description', 'price', 'compareAtPrice', 'sku',
  'category', 'stock', 'isFeatured', 'isActive',
];

// get paginated list of products with optional search/category/isFeatured filter
export const listProducts = async ({ page = 1, limit = 10, search, category, isFeatured } = {}) => {
  //1 build filter object
  const filter = { isDeleted: false };
  //2 if search filter is provided, add it to the filter object
  if (search) filter.name = { $regex: search, $options: 'i' };
  //3 if category filter is provided, add it to the filter object
  if (category) filter.category = category;
  //4 if isFeatured filter is provided, add it to the filter object
  if (isFeatured !== undefined) filter.isFeatured = isFeatured;
  //5 fetch paginated results sorted by createdAt, populating the linked category
  return productCrud.findAndCountAll(filter, { page, limit, sort: { createdAt: -1 }, populate: [{ path: 'category' }] });
};

// get a single product by ID
export const getProductById = async (id) => {
  //1 fetch the product by ID, populating the linked category
  const product = await productCrud.findByPk(id, { populate: [{ path: 'category' }] });
  //2 if not found or isDeleted, throw a 404 error
  if (!product || product.isDeleted) {
    throw createAppError(404, 'product_not_found');
  }
  //3 return the fetched product
  return product;
};

// create a new product with optional multi-image upload
export const createProduct = async (req) => {
  //1 extract product data from request body
  const { name, description, price, compareAtPrice, sku, category, stock, isFeatured, isActive } = req.body;
  const data = {
    name,
    slug: slugifyFunction(name),
    description,
    price,
    compareAtPrice: compareAtPrice ?? null,
    sku: sku ?? null,
    category: category || null,
    stock: stock ?? 0,
    isFeatured: isFeatured ?? false,
    isActive: isActive ?? true,
  };
  //2 if images were uploaded, map them to the images array
  if (req.uploadedFiles?.length) {
    data.images = req.uploadedFiles.map((f) => ({ url: f.url, publicId: f.publicId }));
  }
  //3 create the product in the database
  const product = await productCrud.create(data);
  //4 log audit for product creation
  logAudit({ ...actorFromReq(req), action: 'CREATE', resource: 'Product', details: { id: product._id, name } });
  //5 return the created product
  return product;
};

// update an existing product by ID with optional multi-image replacement
export const updateProduct = async (id, req) => {
  //1 fetch the existing product by ID
  const existing = await productCrud.findByPk(id);
  //2 if not found or isDeleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'product_not_found');
  }
  //3 build update data from a strict whitelist only (prevents mass assignment of slug, isDeleted, images, etc.)
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  //4 resolve the effective price/compareAtPrice (incoming value, falling back to the existing stored value)
  //   and reject the update if the resulting pair is inconsistent (compareAtPrice must exceed price)
  const effectivePrice = data.price !== undefined ? data.price : existing.price;
  const effectiveCompareAtPrice = data.compareAtPrice !== undefined ? data.compareAtPrice : existing.compareAtPrice;
  if (effectiveCompareAtPrice != null && effectiveCompareAtPrice <= effectivePrice) {
    throw createAppError(400, 'compare_at_price_must_exceed_price');
  }
  //5 regenerate slug if name is being changed
  if (data.name) data.slug = slugifyFunction(data.name);
  //6 if new images were uploaded, replace the array and delete all old images from Cloudinary
  if (req.uploadedFiles?.length) {
    data.images = req.uploadedFiles.map((f) => ({ url: f.url, publicId: f.publicId }));
    (existing.images || []).forEach((img) =>
      safeDeleteCloudinaryImage(img.publicId, { resource: 'Product', id, reason: 'replaced_on_update' }),
    );
  }
  //7 update the product in the database
  const updated = await productCrud.findOneAndUpdate({ _id: id }, data);
  //8 log audit for product update
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'Product', details: { id } });
  //9 return the updated product
  return updated;
};

// soft-delete a product by ID, including all its images on Cloudinary
export const deleteProduct = async (id, req) => {
  //1 fetch the existing product by ID
  const existing = await productCrud.findByPk(id);
  //2 if not found or already deleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'product_not_found');
  }
  //3 delete all product images from Cloudinary
  await Promise.all(
    (existing.images || []).map((img) =>
      safeDeleteCloudinaryImage(img.publicId, { resource: 'Product', id, reason: 'product_deleted' }),
    ),
  );
  //4 soft-delete: mark isDeleted instead of removing the document
  const result = await productCrud.findOneAndUpdate({ _id: id }, { isDeleted: true, isActive: false, images: [] });
  //5 log audit for product deletion
  logAudit({ ...actorFromReq(req), action: 'DELETE', resource: 'Product', details: { id } });
  //6 return the result of the soft deletion
  return result;
};