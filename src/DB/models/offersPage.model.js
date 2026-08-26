import mongoose from 'mongoose';

/**
 * Copy and banner for the offers page — a SINGLETON.
 *
 * The offer *cards* on this page are `Package` documents, not fields here: the admin
 * adds and removes offers independently of the page's own heading and banner.
 */
const offersPageSchema = new mongoose.Schema(
  {
    banner: { type: String, default: null },
    bannerPublicId: { type: String, default: null },
    bannerAlt: { type: String, default: '' },
    intro: { type: String, default: '' },
    formHeading: { type: String, default: '' },
    formSubheading: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.models.OffersPage || mongoose.model('OffersPage', offersPageSchema);
