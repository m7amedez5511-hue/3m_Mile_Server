import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true')
  .optional();

const featuresish = z
  .union([z.array(z.string()), z.string()])
  .transform((v) => (Array.isArray(v) ? v : v.split(',').map((f) => f.trim()).filter(Boolean)))
  .optional();

export const createServiceSchema = z.object({
  title: z.string().min(2).max(200),
  shortDescription: z.string().max(300).optional(),
  description: z.string().optional(),
  features: featuresish,
  category: z.string().length(24).optional(),
  order: z.coerce.number().int().optional(),
  isFeatured: booleanish,
  isActive: booleanish,
});

export const updateServiceSchema = createServiceSchema.partial();
