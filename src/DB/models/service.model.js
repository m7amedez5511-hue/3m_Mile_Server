import mongoose from 'mongoose';

// "The Service" — e.g. "Thermal Insulation", "PPF Protection Films", "Nano Ceramic", "Detailing", ...
const serviceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    shortDescription: { type: String, default: '' }, // used in cards/listing
    description: { type: String, default: '' }, // full page description
    features: [{ type: String }], // bullet points e.g. "ضمان 10 سنوات"
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    image: { type: String, default: null },
    imagePublicId: { type: String, default: null },
    gallery: [
      {
        url: { type: String },
        publicId: { type: String },
      },
    ],
    order: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

serviceSchema.index({ category: 1, isActive: 1, isDeleted: 1 });

export default mongoose.models.Service || mongoose.model('Service', serviceSchema);
