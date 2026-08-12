import { z } from 'zod';

// Accepts real booleans (JSON body) or 'true'/'false' strings (multipart form-data)
const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true')
  .optional();

export const createGalleryItemSchema = z.object({
  title: z.string().max(200).optional(),
  service: z.string().length(24).optional(),
  order: z.coerce.number().int().optional(), // coerce handles string values from multipart form-data too
  isActive: booleanish,
});

export const updateGalleryItemSchema = z.object({
  title: z.string().max(200).optional(),
  service: z.string().length(24).nullable().optional(),
  order: z.coerce.number().int().optional(), // coerce handles string values from multipart form-data too
  isActive: booleanish,
});