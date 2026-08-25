import mongoose from 'mongoose';

// "The Product" — shop items
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // The product page renders three distinct blocks of copy: a card teaser, a summary
    // beside the gallery, and the full body. One `description` cannot serve all three
    // without the UI truncating text the admin never approved.
    excerpt: { type: String, default: '' },
    shortDescription: { type: String, default: '' },
    description: { type: String, default: '' },
    // Not required: the public shop is a catalogue — every product converts through a
    // WhatsApp enquiry and no price is ever rendered. Forcing a price would make the
    // admin invent numbers the site does not show.
    price: { type: Number, min: 0, default: 0 },
    compareAtPrice: { type: Number, min: 0, default: null }, // original price when on offer
    sku: { type: String, default: null },
    images: [
      {
        url: { type: String },
        publicId: { type: String },
      },
    ],
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    stock: { type: Number, default: 0, min: 0 },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

productSchema.index({ category: 1, isActive: 1, isDeleted: 1 });
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ price: 1 });

export default mongoose.models.Product || mongoose.model('Product', productSchema);