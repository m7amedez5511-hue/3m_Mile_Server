import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String },
    phone: { type: String },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    workingHours: { type: String },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Branch || mongoose.model('Branch', branchSchema);