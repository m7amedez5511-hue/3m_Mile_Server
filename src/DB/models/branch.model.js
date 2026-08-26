import mongoose from 'mongoose';

// "The Branch"
const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    city: { type: String, default: '' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    mapUrl: { type: String, default: '' }, // google maps link
    // Position of this branch's pin on the branches map image, as CSS percentages.
    // `start` rather than `left` because the site is RTL — the frontend applies it as
    // `inset-inline-start`, which flips with direction.
    pin: {
      top: { type: String, default: '' },
      start: { type: String, default: '' },
    },
    workingHours: { type: String, default: '' },
    image: { type: String, default: null },
    imagePublicId: { type: String, default: null },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// indexes for common query patterns (listBranches: filter by city/isDeleted, sort by order/createdAt)
branchSchema.index({ isDeleted: 1, order: 1, createdAt: -1 });
branchSchema.index({ city: 1 });

export default mongoose.models.Branch || mongoose.model('Branch', branchSchema);