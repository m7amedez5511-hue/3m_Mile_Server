import { z } from 'zod';
import { booleanish, listish, jsonish, slugish, titleBody } from './shared.validator.js';

/**
 * Image slots are deliberately absent from this schema. They are populated from the
 * uploaded files (`req.uploadedSlots`), never from the request body — otherwise a
 * client could point a slot at any URL it liked, and the stored publicId would no
 * longer match the asset the CMS owns.
 *
 * `{name}Alt` fields ARE accepted, because alt text is typed, not uploaded.
 */
export const createServiceSchema = z.object({
  title: z.string().min(2).max(200),
  slug: slugish.optional(),
  heading: z.string().max(300).optional(),
  tagline: z.string().max(500).optional(),
  shortDescription: z.string().max(300).optional(),
  description: z.string().optional(),
  features: listish.optional(),
  enquiry: z.string().max(300).optional(),
  // '' unsets the category; the service maps it to null (`normaliseRef`).
  category: z.string().length(24).optional().or(z.literal('')),
  order: z.coerce.number().int().optional(),
  isFeatured: booleanish.optional(),
  isActive: booleanish.optional(),

  // Detail page copy
  introHeading: z.string().max(300).optional(),
  introBody: z.string().optional(),
  introPoints: jsonish(z.array(titleBody).max(6)).optional(),
  primaryCta: z.string().max(300).optional(),
  benefitsHeading: z.string().max(300).optional(),
  benefits: jsonish(z.array(titleBody).max(12)).optional(),
  secondaryCta: z.string().max(300).optional(),

  // Alt text for the named image slots
  heroImageAlt: z.string().max(300).optional(),
  wideImageAlt: z.string().max(300).optional(),
  gridImageAlt: z.string().max(300).optional(),
});

export const updateServiceSchema = createServiceSchema.partial();
