import mongoose from 'mongoose';

/** Banner above the article grid on the blog index — a SINGLETON. */
const blogIntroSchema = new mongoose.Schema(
  {
    heading: { type: String, default: '' },
    description: { type: String, default: '' },
    image: { type: String, default: null },
    imagePublicId: { type: String, default: null },
    imageAlt: { type: String, default: '' },

    // Exactly one document may exist. The unique index makes the singleton service's
    // upsert atomic — without it, concurrent first reads each inserted their own copy.
    singletonKey: { type: String, default: 'main', unique: true, immutable: true },
  },
  { timestamps: true }
);

export default mongoose.models.BlogIntro || mongoose.model('BlogIntro', blogIntroSchema);
