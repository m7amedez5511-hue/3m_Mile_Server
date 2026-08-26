import { z } from 'zod';
import { slugish } from './shared.validator.js';

// multipart/form-data always arrives as strings, so booleans are coerced
const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true')
  .optional();

// shared cross-field check: if compareAtPrice is provided, it must be
// strictly greater than price (it represents the pre-discount price)
const compareAtPriceAbovePrice = (data, ctx) => {
  if (data.compareAtPrice !== undefined && data.price !== undefined && data.compareAtPrice <= data.price) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'compareAtPrice must be greater than price',
      path: ['compareAtPrice'],
    });
  }
};

const baseProductSchema = z.object({
  name: z.string().min(2).max(200),
  // The admin owns the URL — see resolveSlug in utils/buildSlugify.js.
  slug: slugish.optional(),
  excerpt: z.string().max(500).optional(),
  shortDescription: z.string().max(2000).optional(),
  description: z.string().optional(),
  price: z.coerce.number().min(0).optional(),
  compareAtPrice: z.coerce.number().min(0).optional(),
  sku: z.string().optional(),
  // '' unsets the category; the service maps it to null (`normaliseRef`).
  category: z.string().length(24).optional().or(z.literal('')),
  stock: z.coerce.number().int().min(0).optional(),
  isFeatured: booleanish,
  isActive: booleanish,
});

export const createProductSchema = baseProductSchema.superRefine(compareAtPriceAbovePrice);

// .partial() must run on the base object schema (not on a ZodEffects
// from .superRefine), so the refine is re-applied after partial() here
export const updateProductSchema = baseProductSchema.partial().superRefine(compareAtPriceAbovePrice);