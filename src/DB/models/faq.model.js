import mongoose from 'mongoose';

// "The FAQ"
const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// index for common query pattern (listFaqs: filter by isDeleted, sort by order/createdAt)
faqSchema.index({ isDeleted: 1, order: 1, createdAt: -1 });

export default mongoose.models.Faq || mongoose.model('Faq', faqSchema);