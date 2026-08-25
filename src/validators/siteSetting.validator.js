import { z } from 'zod';

const featuresish = z
  .union([z.array(z.string()), z.string()])
  .transform((v) => (Array.isArray(v) ? v : v.split(',').map((f) => f.trim()).filter(Boolean)))
  .optional();

export const updateSiteSettingSchema = z.object({
  // --- Identity. `phone`/`whatsapp` are the site's only conversion path, so they are
  // managed here and nowhere else. ---
  siteName: z.string().max(150).optional(),
  siteNameFull: z.string().max(200).optional(),
  tagline: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  siteUrl: z.string().max(300).optional(),
  workingHours: z.string().max(200).optional(),
  mapsEmbedId: z.string().max(200).optional(),
  'logo.alt': z.string().max(300).optional(),
  'logo.width': z.coerce.number().int().positive().optional(),
  'logo.height': z.coerce.number().int().positive().optional(),
  'rating.score': z.string().max(10).optional(),
  'rating.reviewCount': z.coerce.number().int().min(0).optional(),

  aboutTitle: z.string().optional(),
  aboutDescription: z.string().optional(),
  aboutFeatures: featuresish,
  warrantyPolicy: z.string().optional(),
  contactPhone: z.string().optional(),
  // `.or(literal(''))` because an admin clearing the field submits an empty string, and
  // a bare .email() would reject it — making the whole Settings form unsaveable whenever
  // no email is set.
  contactEmail: z.string().email().optional().or(z.literal('')),
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
