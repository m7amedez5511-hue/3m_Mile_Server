import { z } from 'zod';
import { booleanish } from './shared.validator.js';

/**
 * A gallery item is EITHER an uploaded asset or a YouTube reel.
 *
 * `type` is accepted in the body because a reel has no file to infer it from. When a
 * file IS uploaded the server still resolves the type from its mimetype and ignores this
 * field — the client is never trusted about what it actually sent.
 */
const shared = {
  title: z.string().max(200).optional(),
  type: z.enum(['image', 'video']).optional(),
  description: z.string().max(2000).optional(),
  alt: z.string().max(300).optional(),
  // Where the photo gallery links onward to — it is an internal-linking device, so the
  // target is content rather than a frontend constant.
  href: z.string().max(500).optional(),
  // YouTube video ids are 11 chars of [A-Za-z0-9_-]; validated so a pasted full URL is
  // rejected with a clear message rather than silently producing a dead embed.
  externalId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{11}$/, 'externalId must be an 11-character YouTube video id')
    .optional()
    .or(z.literal('')),
  service: z.string().length(24).optional(),
  order: z.coerce.number().int().optional(), // coerce handles string values from multipart form-data too
  isActive: booleanish.optional(),
};

export const createGalleryItemSchema = z.object(shared);

export const updateGalleryItemSchema = z.object({
  ...shared,
  service: z.string().length(24).nullable().optional(),
});
