import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    permissions: [
      {
        permission: {
          slug: { type: String, required: true },
          name: { type: String },
        },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.models.Role || mongoose.model('Role', roleSchema);