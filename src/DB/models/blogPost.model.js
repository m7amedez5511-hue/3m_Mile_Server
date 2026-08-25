import mongoose from 'mongoose';

// "The Blog"
const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, default: '' }, // short summary for listing cards
    content: { type: String, required: true },
    coverImage: {
      url: { type: String, default: null },
      imagePublicId: { type: String, default: null },
      // Alt is the accessible description; width/height let the card reserve its aspect
      // box before the image loads, which prevents layout shift. Neither is allowed to
      // change the container's own dimensions.
      alt: { type: String, default: '' },
      width: { type: Number, default: null },
      height: { type: Number, default: null },
    },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Category archives at /category/{slug}. Kept alongside `tags` rather than
    // replacing it — they are different things and the frontend renders only categories.
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    tags: [{ type: String }],
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }, // set when soft-deleted, cleared on restore
  },
  { timestamps: true }
);

blogPostSchema.index({ isPublished: 1, isDeleted: 1, publishedAt: -1 });

export default mongoose.models.BlogPost || mongoose.model('BlogPost', blogPostSchema);