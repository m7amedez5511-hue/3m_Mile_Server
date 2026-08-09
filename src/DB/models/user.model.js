import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: { type: String, required: true, select: false }, // excluded by default now
    phone: { type: String, trim: true },
    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    passwordChangedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 });

export default mongoose.models.User || mongoose.model('User', userSchema);