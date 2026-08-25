import { z } from 'zod';
import { jsonish, numberish } from './shared.validator.js';

/**
 * Keys are dotted because that is literally what the request carries: the admin form
 * posts `hero.ctaLabel`, and Mongo applies the same string as a nested update. Writing
 * the schema in the transport's own shape keeps the whitelist in
 * `homeContent.service.js` and this schema in exact correspondence — a nested Zod
 * object would need flattening in between, which is where drift starts.
 *
 * Image fields are absent: media comes from `req.uploadedSlots`, never the body.
 */
export const updateHomeContentSchema = z
  .object({
    'hero.ctaLabel': z.string().max(120).optional(),
    'hero.ctaText': z.string().max(300).optional(),
    'hero.width': numberish.int().positive().optional(),
    'hero.height': numberish.int().positive().optional(),

    'heroTiles.servicesLabel': z.string().max(120).optional(),
    'heroTiles.branches.label': z.string().max(120).optional(),
    'heroTiles.branches.href': z.string().max(500).optional(),
    'heroTiles.branches.image.alt': z.string().max(300).optional(),
    'heroTiles.gallery.label': z.string().max(120).optional(),
    'heroTiles.gallery.image.alt': z.string().max(300).optional(),
    'heroTiles.gallery.actions': jsonish(
      z.array(
        z.object({
          label: z.string().max(120).default(''),
          href: z.string().max(500).default(''),
          icon: z.string().max(60).default(''),
        }),
      ).max(4),
    ).optional(),

    'whyUs.heading': z.string().max(300).optional(),
    'whyUs.description': z.string().max(2000).optional(),
    'whyUs.points': jsonish(z.array(z.string().max(500)).max(20)).optional(),
    'whyUs.ctaLabel': z.string().max(120).optional(),
    'whyUs.image.alt': z.string().max(300).optional(),

    // Exactly the three badges the design has room for.
    trust: jsonish(
      z.array(
        z.object({
          head: z.string().max(120).default(''),
          sub: z.string().max(120).default(''),
          icon: z.string().max(60).default(''),
          alt: z.string().max(300).optional(),
        }),
      ).max(3),
    ).optional(),

    stats: jsonish(
      z.array(
        z.object({
          value: z.coerce.number().default(0),
          suffix: z.string().max(10).default(''),
          title: z.string().max(120).default(''),
        }),
      ).max(6),
    ).optional(),

    'reviewsIntro.heading': z.string().max(300).optional(),
    'reviewsIntro.description': z.string().max(2000).optional(),

    'contactBlock.heading': z.string().max(300).optional(),
    'contactBlock.subheading': z.string().max(500).optional(),
    'contactBlock.formTitle': z.string().max(120).optional(),
  })
  // Alt-text fields for indexed trust uploads are carried inside the `trust` array
  // itself, so anything else in the body is dropped rather than silently persisted.
  .strip();
