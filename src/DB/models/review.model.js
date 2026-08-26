import mongoose from 'mongoose';

/**
 * Google review screenshots — a COLLECTION.
 *
 * These are images of the Google review UI rather than structured review text, so the
 * model carries no rating/author/body: there is nothing to mark up beyond what the
 * picture shows. `alt` is the only accessible description available, which is why it is
 * required rather than optional.
 */
const reviewSchema = new mongoose.Schema(
  {
    image: { type: String, required: true },
    imagePublicId: { type: String, required: true },
    alt: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

reviewSchema.index({ isDeleted: 1, order: 1, createdAt: -1 });

export default mongoose.models.Review || mongoose.model('Review', reviewSchema);
