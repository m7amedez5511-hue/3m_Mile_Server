import { z } from 'zod';
import { booleanish, numberish } from './shared.validator.js';

/**
 * Validators for the smaller page-section singletons.
 *
 * Grouped in one file because each is a handful of text fields; the homepage keeps its
 * own file because it is an order of magnitude larger.
 */

export const updatePromoSchema = z.object({
  alt: z.string().max(300).optional(),
  width: numberish.int().positive().optional(),
  height: numberish.int().positive().optional(),
  whatsappText: z.string().max(300).optional(),
  // Clamped: a negative delay would fire instantly and anything beyond ~30s means the
  // visitor has already left, so neither is worth persisting.
  delayMs: numberish.int().min(0).max(30000).optional(),
  isActive: booleanish.optional(),
}).strip();

export const updateOffersPageSchema = z.object({
  bannerAlt: z.string().max(300).optional(),
  intro: z.string().max(4000).optional(),
  formHeading: z.string().max(300).optional(),
  formSubheading: z.string().max(500).optional(),
}).strip();

export const updateBlogIntroSchema = z.object({
  heading: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  imageAlt: z.string().max(300).optional(),
}).strip();

export const updateGalleryIntroSchema = z.object({
  'video.heading': z.string().max(300).optional(),
  'video.description': z.string().max(2000).optional(),
  'photo.heading': z.string().max(300).optional(),
  'photo.description': z.string().max(2000).optional(),
}).strip();
