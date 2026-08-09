import mongoose from 'mongoose';

// "Our Work Gallery" — Images / Videos (before-after work gallery)
const galleryItemSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    type: { type: String, enum: ['image', 'video'], required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    thumbnailUrl: { type: String, default: null }, // useful for videos
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null }, // tag which service this work belongs to
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

galleryItemSchema.index({ type: 1, isActive: 1, isDeleted: 1 });

export default mongoose.models.GalleryItem || mongoose.model('GalleryItem', galleryItemSchema);
