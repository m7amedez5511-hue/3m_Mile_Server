import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { safeDeleteCloudinaryImage } from '../utils/softDeleteImage.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';

const reviewCrud = crudService('Review');

// whitelist of fields allowed to be updated directly by the client (image handled separately via uploadedFile)
const UPDATABLE_FIELDS = ['alt', 'order', 'isActive'];

// get paginated list of review screenshots
export const listReviews = async ({ page = 1, limit = 50, isActive } = {}) => {
  //1 build filter object
  const filter = { isDeleted: false };
  //2 the public carousel asks for active only; the admin list asks for everything
  if (isActive !== undefined) filter.isActive = isActive;
  //3 fetch paginated results sorted by order and createdAt
  return reviewCrud.findAndCountAll(filter, { page, limit, sort: { order: 1, createdAt: -1 } });
};

// get a single review by ID
export const getReviewById = async (id) => {
  //1 fetch the review by ID
  const review = await reviewCrud.findByPk(id);
  //2 if not found or isDeleted, throw a 404 error
  if (!review || review.isDeleted) {
    throw createAppError(404, 'review_not_found');
  }
  //3 return the fetched review
  return review;
};

// create a new review screenshot (image is required)
export const createReview = async (req) => {
  //1 the screenshot is the entire content of a review — there is nothing to store without it
  if (!req.uploadedFile) {
    throw createAppError(400, 'image_is_required');
  }
  //2 build the document
  const { alt, order, isActive } = req.body;
  const data = {
    image: req.uploadedFile.url,
    imagePublicId: req.uploadedFile.publicId,
    alt,
    order: order ?? 0,
    isActive: isActive ?? true,
  };
  //3 create the review in the database
  const review = await reviewCrud.create(data);
  //4 log audit for creation
  logAudit({ ...actorFromReq(req), action: 'CREATE', resource: 'Review', details: { id: review._id } });
  //5 return the created review
  return review;
};

// update an existing review by ID with optional image replacement
export const updateReview = async (id, req) => {
  //1 fetch the existing review
  const existing = await reviewCrud.findByPk(id);
  //2 if not found or isDeleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'review_not_found');
  }
  //3 build update data from a strict whitelist only
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  //4 if a new screenshot was uploaded, replace it and delete the old one from Cloudinary
  if (req.uploadedFile) {
    data.image = req.uploadedFile.url;
    data.imagePublicId = req.uploadedFile.publicId;
    safeDeleteCloudinaryImage(existing.imagePublicId, { resource: 'Review', id, reason: 'replaced_on_update' });
  }
  //5 update the review in the database
  const updated = await reviewCrud.findOneAndUpdate({ _id: id }, data);
  //6 log audit for update
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'Review', details: { id } });
  //7 return the updated review
  return updated;
};

// soft-delete a review by ID, including its screenshot on Cloudinary
export const deleteReview = async (id, req) => {
  //1 fetch the existing review
  const existing = await reviewCrud.findByPk(id);
  //2 if not found or already deleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'review_not_found');
  }
  //3 delete the screenshot from Cloudinary
  await safeDeleteCloudinaryImage(existing.imagePublicId, { resource: 'Review', id, reason: 'review_deleted' });
  //4 soft-delete: mark isDeleted instead of removing the document (image/imagePublicId kept since the field is required by schema)
  const result = await reviewCrud.findOneAndUpdate({ _id: id }, { isDeleted: true, isActive: false });
  //5 log audit for deletion
  logAudit({ ...actorFromReq(req), action: 'DELETE', resource: 'Review', details: { id } });
  //6 return the result of the soft deletion
  return result;
};
