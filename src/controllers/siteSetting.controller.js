import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import { getSiteSettings, updateSiteSettings } from '../services/siteSetting.service.js';

// Controller for fetching the site settings singleton
export const getSettings = asyncHandler(async (req, res) => {
  //1 call the service to get (or lazily create) the settings document
  const settings = await getSiteSettings();
  //2 send success response with the fetched settings
  return sendResponse(res, 200, 'settings_fetched', settings);
});

// Controller for updating the site settings singleton
export const updateSettings = asyncHandler(async (req, res) => {
  //1 call the service to update the settings with the request data
  const settings = await updateSiteSettings(req);
  //2 send success response with the updated settings
  return sendResponse(res, 200, 'settings_updated', settings);
});