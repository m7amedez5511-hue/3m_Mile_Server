import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true')
  .optional();

export const createProductSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  compareAtPrice: z.coerce.number().min(0).optional(),
  sku: z.string().optional(),
  category: z.string().length(24).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  isFeatured: booleanish,
  isActive: booleanish,
});

export const updateProductSchema = createProductSchema.partial();
