import mongoose from 'mongoose';

// Shared category used for grouping either Products (shop) or Services.
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    type: { type: String, enum: ['product', 'service'], default: 'product' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// indexes for common query patterns (listCategories: filter by type/isDeleted, sort by order/createdAt)
categorySchema.index({ isDeleted: 1, order: 1, createdAt: -1 });
categorySchema.index({ type: 1 });

export default mongoose.models.Category || mongoose.model('Category', categorySchema);