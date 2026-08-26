import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listPackages,
  getPackageById,
  createPackage as createPackageService,
  updatePackage as updatePackageService,
  deletePackage as deletePackageService,
  getPackageBySlug,
} from '../services/package.service.js';

// Controller for fetching a paginated list of packages
export const getPackages = asyncHandler(async (req, res) => {
  //1 extract pagination and filter parameters from query
  const { page, limit, activeOnly } = req.query;
  //2 call the service to get the list of packages with pagination and optional active-only filter
  const result = await listPackages({
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    activeOnly: activeOnly === 'true',
  });
  //3 send success response with the paginated list of packages
  return sendResponse(res, 200, 'packages_fetched', result);
});

// Controller for fetching a single package by ID
export const getPackage = asyncHandler(async (req, res) => {
  //1 call the service to get the package by ID
  const pkg = await getPackageById(req.params.id);
  //2 send success response with the fetched package
  return sendResponse(res, 200, 'package_fetched', pkg);
});

// Controller for creating a new package
export const createPackage = asyncHandler(async (req, res) => {
  //1 call the service to create a new package with the request data
  const pkg = await createPackageService(req);
  //2 send success response with the created package
  return sendResponse(res, 201, 'package_created', pkg);
});

// Controller for updating an existing package by ID
export const updatePackage = asyncHandler(async (req, res) => {
  //1 call the service to update the package with the request data
  const pkg = await updatePackageService(req.params.id, req);
  //2 send success response with the updated package
  return sendResponse(res, 200, 'package_updated', pkg);
});

// Controller for deleting a package by ID
export const deletePackage = asyncHandler(async (req, res) => {
  //1 call the service to delete the package by ID
  await deletePackageService(req.params.id, req);
  //2 send success response indicating the package was deleted
  return sendResponse(res, 200, 'package_deleted', null);
});
// Controller for fetching a single package by slug — the public site's lookup path
export const getPackageBySlugHandler = asyncHandler(async (req, res) => {
  //1 call the service to get the package by slug
  const doc = await getPackageBySlug(req.params.slug);
  //2 send success response with the fetched package
  return sendResponse(res, 200, 'package_fetched', doc);
});
