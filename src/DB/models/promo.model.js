import mongoose from 'mongoose';

/**
 * The timed promotional overlay — a SINGLETON.
 *
 * `isActive` retires a campaign without deleting it: the public endpoint returns null
 * when it is false, and the modal simply does not render. That is the whole point of
 * the flag — the admin should never have to delete the image to stop showing it.
 */
const promoSchema = new mongoose.Schema(
  {
    image: { type: String, default: null },
    imagePublicId: { type: String, default: null },
    alt: { type: String, default: '' },
    // Intrinsic size of the uploaded artwork. Used only to reserve the aspect box —
    // the modal's own max-width/max-height cap what is actually rendered.
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    whatsappText: { type: String, default: '' },
    // Delay in ms before the overlay appears.
    delayMs: { type: Number, default: 3000 },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Promo || mongoose.model('Promo', promoSchema);
