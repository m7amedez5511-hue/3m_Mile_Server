import mongoose from 'mongoose';


const siteSettingSchema = new mongoose.Schema(
  {
    aboutTitle: { type: String, default: '' },
    aboutDescription: { type: String, default: '' },
    aboutFeatures: [{ type: String }], // bullet points list on the homepage "
    aboutImage: { type: String, default: null },
    aboutImagePublicId: { type: String, default: null },

    stats: {
      experienceYears: { type: Number, default: 0 },
      clientsCount: { type: Number, default: 0 },
      teamMembersCount: { type: Number, default: 0 },
    },

    warrantyPolicy: { type: String, default: '' }, // warranty policy text on the homepage

    contactPhone: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    whatsappNumber: { type: String, default: '' },

    socialLinks: {
      facebook: { type: String, default: '' },
      instagram: { type: String, default: '' },
      tiktok: { type: String, default: '' },
      snapchat: { type: String, default: '' },
      youtube: { type: String, default: '' },
      twitter: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export default mongoose.models.SiteSetting || mongoose.model('SiteSetting', siteSettingSchema);
