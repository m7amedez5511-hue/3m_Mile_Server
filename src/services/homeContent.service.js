import { singletonService } from './singleton.service.js';
import { safeDeleteCloudinaryImage } from '../utils/softDeleteImage.js';

/**
 * Homepage content singleton.
 *
 * Dotted paths are used deliberately: 'hero.ctaLabel' patches one field without
 * rewriting the whole `hero` object, so two admins editing different blocks of the page
 * do not clobber each other.
 */
const UPDATABLE_FIELDS = [
  'hero.ctaLabel', 'hero.ctaText', 'hero.width', 'hero.height',

  'heroTiles.servicesLabel',
  'heroTiles.branches.label', 'heroTiles.branches.href', 'heroTiles.branches.image.alt',
  'heroTiles.gallery.label', 'heroTiles.gallery.actions', 'heroTiles.gallery.image.alt',

  'whyUs.heading', 'whyUs.description', 'whyUs.points', 'whyUs.ctaLabel', 'whyUs.image.alt',

  // Resolved as a whole array by updateHomeContent below, never as `trust.N.*`.
  'trust',

  'stats',
  'reviewsIntro.heading', 'reviewsIntro.description',
  'contactBlock.heading', 'contactBlock.subheading', 'contactBlock.formTitle',
];

/**
 * Media that maps cleanly onto a single document path.
 *
 * The trust badges are absent on purpose: Mongo rejects an update that sets both `trust`
 * and `trust.0.image.url`, so those two cannot be mixed and the array is resolved by
 * hand below instead.
 */
const IMAGE_SLOTS = {
  heroVideo: { urlField: 'hero.video', publicIdField: 'hero.videoPublicId', resourceType: 'video' },
  heroPoster: { urlField: 'hero.poster', publicIdField: 'hero.posterPublicId' },
  whyUsImage: { urlField: 'whyUs.image.url', publicIdField: 'whyUs.image.publicId' },
  branchesTileImage: { urlField: 'heroTiles.branches.image.url', publicIdField: 'heroTiles.branches.image.publicId' },
  galleryTileImage: { urlField: 'heroTiles.gallery.image.url', publicIdField: 'heroTiles.gallery.image.publicId' },
};

const TRUST_SLOTS = ['trustImage0', 'trustImage1', 'trustImage2'];

const base = singletonService('HomeContent', { updatableFields: UPDATABLE_FIELDS, imageSlots: IMAGE_SLOTS });

export const getHomeContent = base.get;

export const updateHomeContent = async (req) => {
  const uploads = TRUST_SLOTS.map((name) => req.uploadedSlots?.[name]);

  //1 the trust strip mixes typed text with uploaded images, so resolve the whole array
  //  here and hand the factory one already-merged value
  if (req.body.trust !== undefined || uploads.some(Boolean)) {
    const existing = await base.get();
    const incoming = req.body.trust ?? existing.trust ?? [];

    req.body.trust = incoming.map((item, index) => {
      const upload = uploads[index];
      const previous = existing.trust?.[index]?.image;

      if (upload && previous?.publicId) {
        safeDeleteCloudinaryImage(previous.publicId, {
          resource: 'HomeContent', id: existing._id, reason: `trust_${index}_replaced_on_update`,
        });
      }

      return {
        head: item.head ?? '',
        sub: item.sub ?? '',
        icon: item.icon ?? '',
        // A text-only edit must not wipe the badge image, so fall back to what is
        // already stored whenever nothing new was uploaded for this index.
        image: upload
          ? { url: upload.url, publicId: upload.publicId, alt: item.alt ?? previous?.alt ?? '' }
          : previous || {},
      };
    });
  }

  //2 delegate the rest — whitelisting, mapped uploads, audit log
  return base.update(req);
};
