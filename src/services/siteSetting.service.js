import mongoose from 'mongoose';
import crudService from './crud.service.js';
import { safeDeleteCloudinaryImage } from '../utils/softDeleteImage.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';
import { getOrCreateSingleton } from '../utils/singletonUpsert.js';

const settingCrud = crudService('SiteSetting');

// whitelist of fields allowed to be updated directly by the client (aboutImage handled separately via uploadedFile).
// dotted keys are passed as-is to Mongo, which natively supports dot-notation updates on nested paths.
const UPDATABLE_FIELDS = [
  'siteName', 'siteNameFull', 'tagline', 'description', 'siteUrl', 'workingHours',
  'mapsEmbedId', 'logo.alt', 'logo.width', 'logo.height',
  'rating.score', 'rating.reviewCount',
  'aboutTitle', 'aboutDescription', 'aboutFeatures', 'warrantyPolicy',
  'pageCopy.servicesIntro', 'pageCopy.branchesHeading', 'pageCopy.branchesSub',
  'pageCopy.shopIntro', 'pageCopy.photoGalleryCta',
  'contactPhone', 'contactEmail', 'whatsappNumber',
  'stats.experienceYears', 'stats.clientsCount', 'stats.teamMembersCount',
  'socialLinks.facebook', 'socialLinks.instagram', 'socialLinks.tiktok',
  'socialLinks.snapchat', 'socialLinks.youtube', 'socialLinks.twitter',
];

// get the settings singleton, creating it on first read if it doesn't exist yet
// instead of forcing a separate "init" endpoint. SiteSetting predates
// singleton.service.js's shared factory and still has its own hand-rolled CRUD, so
// this calls the same getOrCreateSingleton() the factory uses — see singletonUpsert.js
// for why a plain upsert isn't quite enough.
export const getSiteSettings = () => getOrCreateSingleton(mongoose.model('SiteSetting'));

// update the settings singleton with optional about-section image replacement
export const updateSiteSettings = async (req) => {
  // fetch the existing settings document (creating it if it doesn't exist yet)
  const existing = await getSiteSettings();
  // build update data from a strict whitelist only (prevents mass assignment of aboutImagePublicId, _id, etc.)
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  // apply uploaded media to its mapped fields, deleting the assets it replaces.
  //  Named slots rather than a single `req.uploadedFile`, because this document owns
  //  two independent images (the about-section photo and the site logo) and the admin
  //  must be able to replace either without touching the other.
  const slots = {
    aboutImage: { urlField: 'aboutImage', publicIdField: 'aboutImagePublicId' },
    logo: { urlField: 'logo.url', publicIdField: 'logo.publicId', widthField: 'logo.width', heightField: 'logo.height' },
  };
  for (const [name, spec] of Object.entries(slots)) {
    const uploaded = req.uploadedSlots?.[name];
    if (!uploaded) continue;
    data[spec.urlField] = uploaded.url;
    data[spec.publicIdField] = uploaded.publicId;
    if (spec.widthField && typeof uploaded.width === 'number') data[spec.widthField] = uploaded.width;
    if (spec.heightField && typeof uploaded.height === 'number') data[spec.heightField] = uploaded.height;
    const previous = name === 'logo' ? existing.logo?.publicId : existing.aboutImagePublicId;
    if (previous) {
      safeDeleteCloudinaryImage(previous, { resource: 'SiteSetting', id: existing._id, reason: `${name}_replaced_on_update` });
    }
  }
  //4 update the settings document in the database
  const updated = await settingCrud.findOneAndUpdate({ _id: existing._id }, data);
  //5 log audit for settings update
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'SiteSetting', details: { id: existing._id } });
  //6 return the updated settings document
  return updated;
};