import mongoose from 'mongoose';

// "The Service" — e.g. "Thermal Insulation", "PPF Protection Films", "Nano Ceramic", "Detailing", ...

/**
 * A single image slot. Every CMS image is {url, publicId, alt}: the URL renders, the
 * publicId lets Cloudinary delete the superseded asset on replace, the alt is the only
 * accessible description.
 *
 * `_id: false` because these are value objects, not addressable sub-documents.
 */
const imageSlot = new mongoose.Schema(
  {
    url: { type: String, default: null },
    publicId: { type: String, default: null },
    alt: { type: String, default: '' },
  },
  { _id: false }
);

/**
 * WHY NAMED SLOTS RATHER THAN A GENERIC ARRAY
 *
 * The service detail page renders four distinct, differently-shaped containers: a
 * square hero, a wide banner, a portrait tile on the homepage slider, and a
 * three-image collage. A generic `gallery[]` cannot express that — "index 1" is not
 * "the wide banner", so re-ordering uploads in the admin would silently reshuffle the
 * page. Named slots make the layout contract explicit: the admin fills a labelled box
 * and that image can only ever appear in that box.
 *
 * The legacy `image` / `gallery` fields are kept because existing consumers read them.
 */
const serviceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // Full H1 on the detail page — differs from the short card `title` on the live site.
    heading: { type: String, default: '' },
    // Two-line teaser used on the services index and the About page.
    tagline: { type: String, default: '' },
    shortDescription: { type: String, default: '' }, // used in cards/listing
    description: { type: String, default: '' }, // full page description
    features: [{ type: String }], // bullet points e.g. "ضمان 10 سنوات"
    // Prefilled WhatsApp enquiry text for this service's CTAs.
    enquiry: { type: String, default: '' },

    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },

    // --- Named image slots (see comment above) ---
    heroImage: { type: imageSlot, default: () => ({}) },
    wideImage: { type: imageSlot, default: () => ({}) },
    gridImage: { type: imageSlot, default: () => ({}) },
    // Exactly three benefit images on the detail page. Enforced in the validator
    // rather than the schema so a partially-filled draft can still be saved.
    collage: { type: [imageSlot], default: () => [] },

    // --- Detail page copy ---
    introHeading: { type: String, default: '' },
    introBody: { type: String, default: '' },
    introPoints: [
      {
        title: { type: String, default: '' },
        body: { type: String, default: '' },
        _id: false,
      },
    ],
    primaryCta: { type: String, default: '' },
    benefitsHeading: { type: String, default: '' },
    benefits: [
      {
        title: { type: String, default: '' },
        body: { type: String, default: '' },
        _id: false,
      },
    ],
    secondaryCta: { type: String, default: '' },

    // --- Legacy fields, retained for backward compatibility ---
    image: { type: String, default: null },
    imagePublicId: { type: String, default: null },
    gallery: [
      {
        url: { type: String },
        publicId: { type: String },
      },
    ],

    order: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

serviceSchema.index({ category: 1, isActive: 1, isDeleted: 1 });
// The frontend resolves every service by slug, never by ObjectId — its URLs are
// Slug lookups. `unique` already indexes it; this pairs it with the list filters.
serviceSchema.index({ slug: 1, isDeleted: 1 });

export default mongoose.models.Service || mongoose.model('Service', serviceSchema);
