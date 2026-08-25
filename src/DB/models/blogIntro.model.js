import mongoose from 'mongoose';

/** Banner above the article grid on the blog index — a SINGLETON. */
const blogIntroSchema = new mongoose.Schema(
  {
    heading: { type: String, default: '' },
    description: { type: String, default: '' },
    image: { type: String, default: null },
    imagePublicId: { type: String, default: null },
    imageAlt: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.models.BlogIntro || mongoose.model('BlogIntro', blogIntroSchema);
