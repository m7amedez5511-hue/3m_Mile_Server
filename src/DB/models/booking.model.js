import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'pending',
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);
bookingSchema.index({ branch: 1, date: 1 });
bookingSchema.index({ status: 1 });

export default mongoose.models.Booking || mongoose.model('Booking', bookingSchema);