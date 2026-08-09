import mongoose from 'mongoose';

// "The Partner" — e.g. "Toyota", "Honda", "Nissan", etc.
const partnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    logo: { type: String, required: true },
    logoPublicId: { type: String, required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// index for common query pattern (listPartners: filter by isDeleted, sort by order/createdAt)
partnerSchema.index({ isDeleted: 1, order: 1, createdAt: -1 });

export default mongoose.models.Partner || mongoose.model('Partner', partnerSchema);