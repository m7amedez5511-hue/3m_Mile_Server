import { z } from 'zod';
import { booleanish, numberish } from './shared.validator.js';

/**
 * Pin offset on the map image, e.g. "58%". A CSS string, not a number — the frontend
 * applies it directly as `top` / `inset-inline-start`.
 */
const pinOffset = z
  .string()
  .trim()
  .max(10)
  .regex(/^(\d{1,3}(\.\d+)?%)?$/, 'pin offset must be a percentage such as 58%')
  .optional();

const base = {
  name: z.string().min(2).max(200),
  city: z.string().max(120).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(40).optional(),
  whatsapp: z.string().max(40).optional(),
  lat: numberish.optional(),
  lng: numberish.optional(),
  // `.or(z.literal(''))` — the dashboard submits empty text fields so they can be cleared.
  mapUrl: z.string().url().max(1000).optional().or(z.literal('')),
  workingHours: z.string().max(200).optional(),
  'pin.top': pinOffset,
  'pin.start': pinOffset,
  order: z.coerce.number().int().optional(),
  isActive: booleanish.optional(),
};

export const createBranchSchema = z.object(base);

export const updateBranchSchema = createBranchSchema.partial();
