import mongoose from 'mongoose';


const siteSettingSchema = new mongoose.Schema(
  {
    // --- Identity ---
    // The frontend treats these as the single source of truth for the brand. `phone`
    // and `whatsapp` in particular are the site's only conversion path, so nothing is
    // allowed to hard-code them anywhere else.
    siteName: { type: String, default: '' },
    siteNameFull: { type: String, default: '' },
    tagline: { type: String, default: '' },
    description: { type: String, default: '' },
    siteUrl: { type: String, default: '' },
    logo: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
      alt: { type: String, default: '' },
      width: { type: Number, default: null },
      height: { type: Number, default: null },
    },
    workingHours: { type: String, default: '' },
    // Google MyMaps layer id holding all branches; the frontend builds the embed and
    // viewer URLs from it so only the id has to be managed.
    mapsEmbedId: { type: String, default: '' },
    rating: {
      score: { type: String, default: '' },
      reviewCount: { type: Number, default: 0 },
    },

    aboutTitle: { type: String, default: '' },
    aboutDescription: { type: String, default: '' },
    aboutFeatures: [{ type: String }], // bullet points list on the homepage "
    aboutImage: { type: String, default: null },
    aboutImagePublicId: { type: String, default: null },

    stats: {
      experienceYears: { type: Number, default: 0 },
      clientsCount: { type: Number, default: 0 },
      teamMembersCount: { type: Number, default: 0 },
    },

    warrantyPolicy: { type: String, default: '' }, // warranty policy text on the homepage

    // admin-editable page intro/heading copy for pages that otherwise hardcode
    // this text. Grouped as a subdocument (matching the `rating`/`stats` style here)
    // because the admin group these belong to («نصوص الصفحات») addresses them as one
    // related set, not as scattered top-level settings fields.
    pageCopy: {
      servicesIntro: { type: String, default: '' }, // ServicesPage.tsx intro paragraph
      branchesHeading: { type: String, default: '' }, // BranchesPage.tsx heading
      branchesSub: { type: String, default: '' }, // BranchesPage.tsx heading subline
      shopIntro: { type: String, default: '' }, // ShopPage.tsx intro paragraph
      photoGalleryCta: { type: String, default: '' }, // PhotoGalleryPage.tsx CTA button label
    },

    contactPhone: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    whatsappNumber: { type: String, default: '' },

    socialLinks: {
      facebook: { type: String, default: '' },
      instagram: { type: String, default: '' },
      tiktok: { type: String, default: '' },
      snapchat: { type: String, default: '' },
      youtube: { type: String, default: '' },
      twitter: { type: String, default: '' },
    },
    // Empty strings are filtered out by the frontend rather than rendered as dead
    // links, so retiring a social account means clearing the field, not deleting it.

    // Exactly one document may exist. The unique index makes the singleton service's
    // upsert atomic — without it, concurrent first reads each inserted their own copy.
    singletonKey: { type: String, default: 'main', unique: true, immutable: true },
  },
  { timestamps: true }
);

export default mongoose.models.SiteSetting || mongoose.model('SiteSetting', siteSettingSchema);
