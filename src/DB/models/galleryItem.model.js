import mongoose from 'mongoose';

// "Our Work Gallery" — Images / Videos (before-after work gallery)
const galleryItemSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    type: { type: String, enum: ['image', 'video'], required: true },
    /**
     * Required only for Cloudinary-hosted items. A YouTube reel identifies itself with
     * `externalId` and has no uploaded asset, so an unconditional `required: true` here
     * would make every reel unsaveable.
     */
    url: { type: String, default: null, required: [function () { return !this.externalId; }, 'url is required unless externalId is set'] },
    publicId: { type: String, default: null, required: [function () { return !this.externalId; }, 'publicId is required unless externalId is set'] },
    thumbnailUrl: { type: String, default: null }, // useful for videos
    description: { type: String, default: '' },
    alt: { type: String, default: '' },
    /**
     * Where clicking this item goes. The photo gallery is an internal-linking device,
     * not a lightbox — each image links to the related service page — so the target is
     * content the admin controls, not a frontend constant.
     */
    href: { type: String, default: '' },
    /**
     * YouTube video id for reels. The video gallery embeds YouTube Shorts rather than
     * self-hosting, so those items carry an id here and leave `url`/`publicId` to the
     * Cloudinary-backed ones. Exactly one of the two is populated.
     */
    externalId: { type: String, default: '' },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null }, // tag which service this work belongs to
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

galleryItemSchema.index({ type: 1, isActive: 1, isDeleted: 1 });

export default mongoose.models.GalleryItem || mongoose.model('GalleryItem', galleryItemSchema);
