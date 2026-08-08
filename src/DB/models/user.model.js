import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: true },
    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    passwordChangedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', userSchema);