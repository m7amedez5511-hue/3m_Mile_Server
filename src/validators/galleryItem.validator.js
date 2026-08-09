import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true')
  .optional();

export const createGalleryItemSchema = z.object({
  title: z.string().max(200).optional(),
  service: z.string().length(24).optional(),
  order: z.coerce.number().int().optional(),
  isActive: booleanish,
});

export const updateGalleryItemSchema = z.object({
  title: z.string().max(200).optional(),
  service: z.string().length(24).nullable().optional(),
  order: z.coerce.number().int().optional(),
  isActive: booleanish,
});
