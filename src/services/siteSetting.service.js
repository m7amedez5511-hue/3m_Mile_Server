import crudService from './crud.service.js';
import { deleteImage as deleteCloudinaryImage } from '../utils/Cloudinary.config.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';

const settingCrud = crudService('SiteSetting');

// Singleton: create the (one and only) settings document on first read
// if it doesn't exist yet, instead of forcing a separate "init" endpoint.
export const getSiteSettings = async () => {
  const { record } = await settingCrud.findOrCreate({}, {});
  return record;
};

export const updateSiteSettings = async (req) => {
  const existing = await getSiteSettings();
  const data = { ...req.body };

  if (req.uploadedFile) {
    data.aboutImage = req.uploadedFile.url;
    data.aboutImagePublicId = req.uploadedFile.publicId;
    if (existing.aboutImagePublicId) {
      deleteCloudinaryImage(existing.aboutImagePublicId).catch(() => {});
    }
  }

  const updated = await settingCrud.findOneAndUpdate({ _id: existing._id }, data);
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'SiteSetting', details: { id: existing._id } });
  return updated;
};
