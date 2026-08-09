import crudService from './crud.service.js';
import { safeDeleteCloudinaryImage } from '../utils/softDeleteImage.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';

const settingCrud = crudService('SiteSetting');

// whitelist of fields allowed to be updated directly by the client (aboutImage handled separately via uploadedFile).
// dotted keys are passed as-is to Mongo, which natively supports dot-notation updates on nested paths.
const UPDATABLE_FIELDS = [
  'aboutTitle', 'aboutDescription', 'aboutFeatures', 'warrantyPolicy',
  'contactPhone', 'contactEmail', 'whatsappNumber',
  'stats.experienceYears', 'stats.clientsCount', 'stats.teamMembersCount',
  'socialLinks.facebook', 'socialLinks.instagram', 'socialLinks.tiktok',
  'socialLinks.snapchat', 'socialLinks.youtube', 'socialLinks.twitter',
];

// get the settings singleton, creating it on first read if it doesn't exist yet
// instead of forcing a separate "init" endpoint
export const getSiteSettings = async () => {
  //1 find the single settings document or create an empty one if none exists
  const { record } = await settingCrud.findOrCreate({}, {});
  //2 return the settings document
  return record;
};

// update the settings singleton with optional about-section image replacement
export const updateSiteSettings = async (req) => {
  //1 fetch the existing settings document (creating it if it doesn't exist yet)
  const existing = await getSiteSettings();
  //2 build update data from a strict whitelist only (prevents mass assignment of aboutImagePublicId, _id, etc.)
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  //3 if a new about-section image was uploaded, replace it and delete the old one from Cloudinary
  if (req.uploadedFile) {
    data.aboutImage = req.uploadedFile.url;
    data.aboutImagePublicId = req.uploadedFile.publicId;
    if (existing.aboutImagePublicId) {
      safeDeleteCloudinaryImage(existing.aboutImagePublicId, { resource: 'SiteSetting', id: existing._id, reason: 'replaced_on_update' });
    }
  }
  //4 update the settings document in the database
  const updated = await settingCrud.findOneAndUpdate({ _id: existing._id }, data);
  //5 log audit for settings update
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'SiteSetting', details: { id: existing._id } });
  //6 return the updated settings document
  return updated;
};