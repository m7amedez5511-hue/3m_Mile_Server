import { z } from 'zod';
import { booleanish } from './shared.validator.js';

/**
 * `alt` is required rather than optional: these are screenshots of the Google review UI,
 * so the alt text is the only description a screen reader will ever get.
 */
export const createReviewSchema = z.object({
  alt: z.string().min(2).max(300),
  order: z.coerce.number().int().optional(),
  isActive: booleanish.optional(),
});

export const updateReviewSchema = createReviewSchema.partial();
