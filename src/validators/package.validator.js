import { z } from 'zod';
import { slugish } from './shared.validator.js';

// multipart/form-data always arrives as strings, so booleans are coerced
const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true')
  .optional();

// shared cross-field check: if both dates are provided, endDate must be after startDate
const endDateAfterStartDate = (data, ctx) => {
  if (data.startDate && data.endDate && data.endDate <= data.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endDate must be after startDate',
      path: ['endDate'],
    });
  }
};

const basePackageSchema = z.object({
  title: z.string().min(2).max(200),
  // The admin owns the URL — see resolveSlug in utils/buildSlugify.js.
  slug: slugish.optional(),
  description: z.string().optional(),
  // '' unlinks the service; updatePackage maps it to null.
  service: z.string().length(24).optional().or(z.literal('')),
  price: z.coerce.number().min(0).optional(),
  discountPercentage: z.coerce.number().min(0).max(100).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  order: z.coerce.number().int().optional(),
  isActive: booleanish,
});

export const createPackageSchema = basePackageSchema.superRefine(endDateAfterStartDate);

// .partial() must run on the base object schema (not on a ZodEffects
// from .superRefine), so the refine is re-applied after partial() here
export const updatePackageSchema = basePackageSchema.partial().superRefine(endDateAfterStartDate);