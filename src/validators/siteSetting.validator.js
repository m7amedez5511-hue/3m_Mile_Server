import { z } from 'zod';

const featuresish = z
  .union([z.array(z.string()), z.string()])
  .transform((v) => (Array.isArray(v) ? v : v.split(',').map((f) => f.trim()).filter(Boolean)))
  .optional();

export const updateSiteSettingSchema = z.object({
  aboutTitle: z.string().optional(),
  aboutDescription: z.string().optional(),
  aboutFeatures: featuresish,
  warrantyPolicy: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  whatsappNumber: z.string().optional(),
  'stats.experienceYears': z.coerce.number().int().optional(),
  'stats.clientsCount': z.coerce.number().int().optional(),
  'stats.teamMembersCount': z.coerce.number().int().optional(),
  'socialLinks.facebook': z.string().optional(),
  'socialLinks.instagram': z.string().optional(),
  'socialLinks.tiktok': z.string().optional(),
  'socialLinks.snapchat': z.string().optional(),
  'socialLinks.youtube': z.string().optional(),
  'socialLinks.twitter': z.string().optional(),
}).partial();
