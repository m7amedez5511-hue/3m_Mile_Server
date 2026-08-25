import mongoose from 'mongoose';

/**
 * Warranty policy — a COLLECTION, one document per group. Each group renders as one tab
 * on the warranty page and holds one or more coverage tiers.
 *
 * `warranty` and `maintenance` are free text: they hold durations or prose.
 */
const tierSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    warranty: { type: String, default: '' },
    maintenance: { type: String, default: '' },
    terms: [{ type: String }],
  },
  { _id: false }
);

const warrantyGroupSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    intro: { type: String, default: '' },
    tiers: [tierSchema],
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

warrantyGroupSchema.index({ isDeleted: 1, order: 1, createdAt: -1 });

export default mongoose.models.WarrantyGroup || mongoose.model('WarrantyGroup', warrantyGroupSchema);
