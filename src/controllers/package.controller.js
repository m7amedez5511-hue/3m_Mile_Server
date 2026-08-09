import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listPackages,
  getPackageById,
  createPackage as createPackageService,
  updatePackage as updatePackageService,
  deletePackage as deletePackageService,
} from '../services/package.service.js';

export const getPackages = asyncHandler(async (req, res) => {
  const { page, limit, activeOnly } = req.query;
  const result = await listPackages({
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    activeOnly: activeOnly === 'true',
  });
  return sendResponse(res, 200, 'packages_fetched', result);
});

export const getPackage = asyncHandler(async (req, res) => {
  const pkg = await getPackageById(req.params.id);
  return sendResponse(res, 200, 'package_fetched', pkg);
});

export const createPackage = asyncHandler(async (req, res) => {
  const pkg = await createPackageService(req);
  return sendResponse(res, 201, 'package_created', pkg);
});

export const updatePackage = asyncHandler(async (req, res) => {
  const pkg = await updatePackageService(req.params.id, req);
  return sendResponse(res, 200, 'package_updated', pkg);
});

export const deletePackage = asyncHandler(async (req, res) => {
  await deletePackageService(req.params.id, req);
  return sendResponse(res, 200, 'package_deleted', null);
});
