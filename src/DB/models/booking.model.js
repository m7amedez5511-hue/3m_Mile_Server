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

export default mongoose.models.Booking || mongoose.model('Booking', bookingSchema);