import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { deleteImage as deleteCloudinaryImage } from '../utils/Cloudinary.config.js';
import { slugifyFunction } from '../utils/buildSlugify.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';

const productCrud = crudService('Product');

export const listProducts = async ({ page = 1, limit = 10, search, category, isFeatured } = {}) => {
  const filter = { isDeleted: false };
  if (search) filter.name = { $regex: search, $options: 'i' };
  if (category) filter.category = category;
  if (isFeatured !== undefined) filter.isFeatured = isFeatured;

  return productCrud.findAndCountAll(filter, {
    page,
    limit,
    sort: { createdAt: -1 },
    populate: [{ path: 'category' }],
  });
};

export const getProductById = async (id) => {
  const product = await productCrud.findByPk(id, { populate: [{ path: 'category' }] });
  if (!product || product.isDeleted) {
    throw createAppError(404, 'product_not_found');
  }
  return product;
};

export const createProduct = async (req) => {
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

  if (req.uploadedFiles?.length) {
    data.images = req.uploadedFiles.map((f) => ({ url: f.url, publicId: f.publicId }));
  }

  const product = await productCrud.create(data);
  logAudit({ ...actorFromReq(req), action: 'CREATE', resource: 'Product', details: { id: product._id, name } });
  return product;
};

export const updateProduct = async (id, req) => {
  const existing = await productCrud.findByPk(id);
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'product_not_found');
  }

  const data = { ...req.body };
  if (data.name) data.slug = slugifyFunction(data.name);

  if (req.uploadedFiles?.length) {
    data.images = req.uploadedFiles.map((f) => ({ url: f.url, publicId: f.publicId }));
    (existing.images || []).forEach((img) => deleteCloudinaryImage(img.publicId).catch(() => {}));
  }

  const updated = await productCrud.findOneAndUpdate({ _id: id }, data);
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'Product', details: { id } });
  return updated;
};

export const deleteProduct = async (id, req) => {
  const existing = await productCrud.findByPk(id);
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'product_not_found');
  }

  (existing.images || []).forEach((img) => deleteCloudinaryImage(img.publicId).catch(() => {}));

  const result = await productCrud.findOneAndDelete({ _id: id });
  logAudit({ ...actorFromReq(req), action: 'DELETE', resource: 'Product', details: { id } });
  return result;
};
