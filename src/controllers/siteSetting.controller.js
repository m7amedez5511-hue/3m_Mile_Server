import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import { getSiteSettings, updateSiteSettings } from '../services/siteSetting.service.js';

export const getSettings = asyncHandler(async (req, res) => {
  const settings = await getSiteSettings();
  return sendResponse(res, 200, 'settings_fetched', settings);
});

export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await updateSiteSettings(req);
  return sendResponse(res, 200, 'settings_updated', settings);
});
