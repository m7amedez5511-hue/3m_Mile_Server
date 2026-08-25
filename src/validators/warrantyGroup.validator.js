import { z } from 'zod';
import { booleanish, jsonish, slugish } from './shared.validator.js';

/** `warranty` and `maintenance` are free text: they hold durations or prose. */
const tier = z.object({
  title: z.string().min(1).max(200),
  warranty: z.string().max(500).default(''),
  maintenance: z.string().max(1000).default(''),
  terms: z.array(z.string().max(1000)).max(30).default([]),
});

export const createWarrantyGroupSchema = z.object({
  title: z.string().min(2).max(200),
  slug: slugish.optional(),
  intro: z.string().max(2000).optional(),
  tiers: jsonish(z.array(tier).max(20)).optional(),
  order: z.coerce.number().int().optional(),
  isActive: booleanish.optional(),
});

export const updateWarrantyGroupSchema = createWarrantyGroupSchema.partial();
