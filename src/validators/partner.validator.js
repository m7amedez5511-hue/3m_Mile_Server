import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true')
  .optional();

export const createPartnerSchema = z.object({
  name: z.string().min(2).max(150),
  order: z.coerce.number().int().optional(),
  isActive: booleanish,
});

export const updatePartnerSchema = createPartnerSchema.partial();
