import mongoose from 'mongoose';

const packageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null },
    price: { type: Number, min: 0, default: null },
    discountPercentage: { type: Number, min: 0, max: 100, default: null },
    image: { type: String, default: null },
    imagePublicId: { type: String, default: null },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// indexes for common query patterns (listPackages: filter by isDeleted/isActive, sort by order/createdAt)
packageSchema.index({ isDeleted: 1, order: 1, createdAt: -1 });
packageSchema.index({ service: 1 });

export default mongoose.models.Package || mongoose.model('Package', packageSchema);