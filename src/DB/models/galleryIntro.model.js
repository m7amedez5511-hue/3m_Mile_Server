import mongoose from 'mongoose';

/**
 * Heading and description shown above each work gallery — a SINGLETON.
 *
 * Two blocks in one document because both galleries are one admin screen; the gallery
 * *items* themselves are `GalleryItem` documents.
 */
const galleryIntroSchema = new mongoose.Schema(
  {
    video: {
      heading: { type: String, default: '' },
      description: { type: String, default: '' },
    },
    photo: {
      heading: { type: String, default: '' },
      description: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export default mongoose.models.GalleryIntro || mongoose.model('GalleryIntro', galleryIntroSchema);
