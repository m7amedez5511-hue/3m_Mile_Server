import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true')
  .optional();

export const createPackageSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().optional(),
  service: z.string().length(24).optional(),
  price: z.coerce.number().min(0).optional(),
  discountPercentage: z.coerce.number().min(0).max(100).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  order: z.coerce.number().int().optional(),
  isActive: booleanish,
});

export const updatePackageSchema = createPackageSchema.partial();
