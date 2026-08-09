import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listGalleryItems,
  getGalleryItemById,
  createGalleryItem as createGalleryItemService,
  updateGalleryItem as updateGalleryItemService,
  deleteGalleryItem as deleteGalleryItemService,
} from '../services/galleryItem.service.js';

// Controller for fetching a paginated list of gallery items
export const getGalleryItems = asyncHandler(async (req, res) => {
  //1 extract pagination and filter parameters from query
  const { page, limit, type, service } = req.query;
  //2 call the service to get the list of gallery items with pagination and optional filters
  const result = await listGalleryItems({ page: Number(page) || 1, limit: Number(limit) || 12, type, service });
  //3 send success response with the paginated list of gallery items
  return sendResponse(res, 200, 'gallery_items_fetched', result);
});

// Controller for fetching a single gallery item by ID
export const getGalleryItem = asyncHandler(async (req, res) => {
  //1 call the service to get the gallery item by ID
  const item = await getGalleryItemById(req.params.id);
  //2 send success response with the fetched gallery item
  return sendResponse(res, 200, 'gallery_item_fetched', item);
});

// Controller for creating a new gallery image item
export const createGalleryImage = asyncHandler(async (req, res) => {
  //1 call the service to create a new gallery item with type 'image'
  const item = await createGalleryItemService(req, 'image');
  //2 send success response with the created gallery item
  return sendResponse(res, 201, 'gallery_item_created', item);
});

// Controller for creating a new gallery video item
export const createGalleryVideo = asyncHandler(async (req, res) => {
  //1 call the service to create a new gallery item with type 'video'
  const item = await createGalleryItemService(req, 'video');
  //2 send success response with the created gallery item
  return sendResponse(res, 201, 'gallery_item_created', item);
});

// Controller for updating gallery item metadata by ID
export const updateGalleryItem = asyncHandler(async (req, res) => {
  //1 call the service to update the gallery item metadata with the request data
  const item = await updateGalleryItemService(req.params.id, req);
  //2 send success response with the updated gallery item
  return sendResponse(res, 200, 'gallery_item_updated', item);
});

// Controller for deleting a gallery item by ID
export const deleteGalleryItem = asyncHandler(async (req, res) => {
  //1 call the service to delete the gallery item by ID
  await deleteGalleryItemService(req.params.id, req);
  //2 send success response indicating the gallery item was deleted
  return sendResponse(res, 200, 'gallery_item_deleted', null);
});