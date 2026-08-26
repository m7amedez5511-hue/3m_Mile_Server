import { z } from 'zod';
import { slugish } from './shared.validator.js';

// multipart/form-data always arrives as strings, so booleans are coerced
const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true')
  .optional();

export const createCategorySchema = z.object({
  // The admin owns the URL — see resolveSlug in utils/buildSlugify.js.
  slug: slugish.optional(),
  name: z.string().min(2).max(150),
  // 'blog' backs the /category/{slug} article archives.
  type: z.enum(['product', 'service', 'blog']).optional(),
  description: z.string().max(1000).optional(),
  order: z.coerce.number().int().optional(),
  isActive: booleanish,
});

export const updateCategorySchema = z.object({
  // Must be declared, or Zod strips it before `updateCategory` can re-resolve the slug.
  slug: slugish.optional(),
  name: z.string().min(2).max(150).optional(),
  // 'blog' backs the /category/{slug} article archives.
  type: z.enum(['product', 'service', 'blog']).optional(),
  description: z.string().max(1000).optional(),
  order: z.coerce.number().int().optional(),
  isActive: booleanish,
});
