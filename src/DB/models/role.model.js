import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    // Only one role name is allowed in this system — the sole
    // System Administrator role. Enforced at both the schema level
    // (enum) and the service level (single-document constraint).
    name: { type: String, required: true, unique: true, enum: ['Admin'] },
    permissions: [
      {
        permission: {
          slug: { type: String, required: true },
          name: { type: String },
        },
      },
    ],
    // Prevents this role from ever being deleted via the API.
    isSystem: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.Role || mongoose.model('Role', roleSchema);