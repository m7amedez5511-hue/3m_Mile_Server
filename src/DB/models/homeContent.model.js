import mongoose from 'mongoose';

/**
 * Homepage content — a SINGLETON. Exactly one document exists; the admin edits it in
 * place. Read through `singletonService`, which creates the empty document on first
 * read so the public site never 404s on a fresh install.
 *
 * Only the blocks the homepage actually renders live here. Partner logos are the
 * `Partner` collection and review screenshots are the `Review` collection, because both
 * are lists the admin adds/removes items from — this document only carries their
 * headings.
 */

// Every image on the site is stored as {url, publicId}: the URL is what the frontend
// renders, the publicId is what Cloudinary needs to delete the old asset on replace.
const image = {
  url: { type: String, default: null },
  publicId: { type: String, default: null },
  alt: { type: String, default: '' },
};

const homeContentSchema = new mongoose.Schema(
  {
    hero: {
      video: { type: String, default: null },
      videoPublicId: { type: String, default: null },
      poster: { type: String, default: null },
      posterPublicId: { type: String, default: null },
      // Intrinsic dimensions of the video, used to reserve the aspect box before it
      // loads. The layout does NOT resize to them — see the fixed-height container in
      // components/home/VideoHero.tsx.
      width: { type: Number, default: null },
      height: { type: Number, default: null },
      ctaLabel: { type: String, default: '' },
      ctaText: { type: String, default: '' },
    },

    heroTiles: {
      servicesLabel: { type: String, default: '' },
      branches: {
        label: { type: String, default: '' },
        href: { type: String, default: '' },
        image,
      },
      gallery: {
        label: { type: String, default: '' },
        image,
        actions: [
          {
            label: { type: String, default: '' },
            href: { type: String, default: '' },
            icon: { type: String, default: '' },
          },
        ],
      },
    },

    // The three badges under the hero grid. Each is either an uploaded image or one of
    // the frontend's built-in icons — never both.
    trust: [
      {
        head: { type: String, default: '' },
        sub: { type: String, default: '' },
        image,
        icon: { type: String, default: '' },
      },
    ],

    whyUs: {
      heading: { type: String, default: '' },
      description: { type: String, default: '' },
      image,
      points: [{ type: String }],
      ctaLabel: { type: String, default: '' },
    },

    // `value` is the number the count-up animates to; `suffix` is rendered verbatim
    // after it (e.g. "K"), so the admin controls "25K" without the frontend parsing.
    stats: [
      {
        value: { type: Number, default: 0 },
        suffix: { type: String, default: '' },
        title: { type: String, default: '' },
      },
    ],

    reviewsIntro: {
      heading: { type: String, default: '' },
      description: { type: String, default: '' },
    },

    contactBlock: {
      heading: { type: String, default: '' },
      subheading: { type: String, default: '' },
      formTitle: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export default mongoose.models.HomeContent || mongoose.model('HomeContent', homeContentSchema);
