import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { generateUniqueString } from '../utils/generate-Unique-String.js';
import { deleteImage as deleteCloudinaryImage } from '../utils/Cloudinary.config.js';
import { slugifyFunction } from '../utils/buildSlugify.js';

const categoryCrud = crudService('Category');



export const listCategories = async ({ page = 1, limit = 10, search } = {}) => {
  const filter = { isDeleted: false };
  if (search) filter.name = { $regex: search, $options: 'i' };

  return categoryCrud.findAndCountAll(filter, {
    page,
    limit,
    sort: { createdAt: -1 },
  });
};

export const getCategoryById = async (id) => {
  const category = await categoryCrud.findByPk(id);
  if (!category || category.isDeleted) {
    throw createAppError(404, 'category_not_found');
  }
  return category;
};

export const createCategory = async ({ name, isActive }, uploadedFile) => {
  const data = {
    name,
    slug: slugifyFunction(name),
    isActive: isActive ?? true,
  };

  if (uploadedFile) {
    data.image = uploadedFile.url;
    data.imagePublicId = uploadedFile.publicId;
  }

  return categoryCrud.create(data);
};

export const updateCategory = async (id, updateData, uploadedFile) => {
  const existing = await categoryCrud.findByPk(id);
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'category_not_found');
  }

  const data = { ...updateData };
  if (updateData.name) {
    data.slug = slugifyFunction(updateData.name);
  }

  if (uploadedFile) {
    data.image = uploadedFile.url;
    data.imagePublicId = uploadedFile.publicId;

    // Replace-then-delete ordering: never leave the record without an
    // image just because the old asset failed to delete.
    if (existing.imagePublicId) {
      deleteCloudinaryImage(existing.imagePublicId).catch(() => {});
    }
  }

  return categoryCrud.findOneAndUpdate({ _id: id }, data);
};

export const deleteCategory = async (id) => {
  const existing = await categoryCrud.findByPk(id);
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'category_not_found');
  }

  if (existing.imagePublicId) {
    await deleteCloudinaryImage(existing.imagePublicId).catch(() => {});
  }

  return categoryCrud.findOneAndDelete({ _id: id });
};