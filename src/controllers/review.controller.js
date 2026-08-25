import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listReviews,
  getReviewById,
  createReview as createReviewService,
  updateReview as updateReviewService,
  deleteReview as deleteReviewService,
} from '../services/review.service.js';

// Controller for fetching a paginated list of review screenshots
export const getReviews = asyncHandler(async (req, res) => {
  //1 extract pagination and filter parameters from query
  const { page, limit, isActive } = req.query;
  //2 call the service to get the list
  const result = await listReviews({
    page: Number(page) || 1,
    limit: Number(limit) || 50,
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
  });
  //3 send success response with the list
  return sendResponse(res, 200, 'reviews_fetched', result);
});

// Controller for fetching a single review by ID
export const getReview = asyncHandler(async (req, res) => {
  //1 call the service to get the review by ID
  const review = await getReviewById(req.params.id);
  //2 send success response with the fetched review
  return sendResponse(res, 200, 'review_fetched', review);
});

// Controller for creating a new review screenshot
export const createReview = asyncHandler(async (req, res) => {
  //1 call the service to create the review
  const review = await createReviewService(req);
  //2 send success response with the created review
  return sendResponse(res, 201, 'review_created', review);
});

// Controller for updating an existing review by ID
export const updateReview = asyncHandler(async (req, res) => {
  //1 call the service to update the review
  const review = await updateReviewService(req.params.id, req);
  //2 send success response with the updated review
  return sendResponse(res, 200, 'review_updated', review);
});

// Controller for deleting a review by ID
export const deleteReview = asyncHandler(async (req, res) => {
  //1 call the service to delete the review
  await deleteReviewService(req.params.id, req);
  //2 send success response indicating the review was deleted
  return sendResponse(res, 200, 'review_deleted', null);
});
