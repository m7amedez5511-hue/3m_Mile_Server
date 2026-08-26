import crudService from './crud.service.js';
import { safeDeleteCloudinaryImage } from '../utils/softDeleteImage.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';

/**
 * Factory for page-section singletons — HomeContent, Promo, OffersPage, BlogIntro,
 * GalleryIntro.
 *
 * Each of these is one document that the admin edits in place; there is no list, no
 * create, no delete. The behaviour is identical across all five, so it lives here once:
 * the typed models stay separate (a homepage hero and a promo popup validate
 * differently) without five copy-pasted CRUD stacks behind them.
 *
 * The document is created on first read rather than by a migration, so a fresh install
 * serves an empty-but-valid document instead of 404-ing the public site — which matters
 * here because the site launches with no content at all.
 */

/** Read a dotted path: getPath(doc, 'hero.videoPublicId'). */
const getPath = (obj, path) => path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);

/**
 * @param {string} modelName
 * @param {object} config
 * @param {string[]} config.updatableFields  whitelist; dotted paths allowed — Mongo
 *   applies them natively as nested updates, so 'hero.ctaLabel' patches one field
 *   without rewriting the whole `hero` object.
 * @param {Record<string, {urlField: string, publicIdField: string, resourceType?: string}>} [config.imageSlots]
 *   maps an upload field name to the document paths that store its URL and publicId.
 */
export const singletonService = (modelName, { updatableFields, imageSlots = {} }) => {
  const crud = crudService(modelName);

  /** Fetch the singleton, creating an empty one on first read. */
  const get = async () => {
    const { record } = await crud.findOrCreate({}, {});
    return record;
  };

  const update = async (req) => {
    //1 fetch the existing document (creating it if this is the first write)
    const existing = await get();

    //2 build the update from a strict whitelist — prevents mass assignment of _id,
    //  publicId fields, and anything else not explicitly editable
    const data = {};
    for (const field of updatableFields) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }

    //3 apply uploaded media to its mapped paths, queueing the replaced assets for
    //  deletion. Only fields actually uploaded are touched.
    const slots = req.uploadedSlots || {};
    for (const [slotName, spec] of Object.entries(imageSlots)) {
      const uploaded = slots[slotName];
      if (!uploaded) continue;

      const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
      data[spec.urlField] = file.url;
      data[spec.publicIdField] = file.publicId;

      const previous = getPath(existing, spec.publicIdField);
      if (previous) {
        safeDeleteCloudinaryImage(previous, {
          resource: modelName,
          id: existing._id,
          // Videos need the explicit resource type or Cloudinary's destroy() looks for
          // an image with that id and silently finds nothing.
          resourceType: spec.resourceType || 'image',
          reason: `${slotName}_replaced_on_update`,
        });
      }
    }

    //4 persist
    const updated = await crud.findOneAndUpdate({ _id: existing._id }, data);
    //5 log audit
    logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: modelName, details: { id: existing._id } });
    //6 return the updated document
    return updated;
  };

  return { get, update };
};
