import { z } from 'zod';

// multipart/form-data always arrives as strings, so booleans are coerced
const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true')
  .optional();

export const createCategorySchema = z.object({
  name: z.string().min(2).max(150),
  type: z.enum(['product', 'service']).optional(),
  order: z.coerce.number().int().optional(),
  isActive: booleanish,
});

export const updateCategorySchema = z.object({
  name: z.string().min(2).max(150).optional(),
  type: z.enum(['product', 'service']).optional(),
  order: z.coerce.number().int().optional(),
  isActive: booleanish,
});
