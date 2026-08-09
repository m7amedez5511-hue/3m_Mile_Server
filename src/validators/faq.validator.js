import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true')
  .optional();

export const createFaqSchema = z.object({
  question: z.string().min(2).max(300),
  answer: z.string().min(1),
  order: z.coerce.number().int().optional(),
  isActive: booleanish,
});

export const updateFaqSchema = createFaqSchema.partial();
