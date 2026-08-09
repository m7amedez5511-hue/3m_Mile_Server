import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true')
  .optional();

export const createBranchSchema = z.object({
  name: z.string().min(2).max(200),
  city: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  mapUrl: z.string().url().optional(),
  workingHours: z.string().optional(),
  order: z.coerce.number().int().optional(),
  isActive: booleanish,
});

export const updateBranchSchema = createBranchSchema.partial();
