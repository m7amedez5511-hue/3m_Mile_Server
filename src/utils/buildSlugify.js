import mongoose from 'mongoose';

/**
 * Slug generation — Unicode-aware because the public URLs are Arabic.
 *
 * An ASCII-only `[^a-z0-9]+` rule would strip every Arabic character, leaving an empty
 * slug; transliterating produces one no admin recognises. So: keep letters and numbers
 * in any script, collapse everything else to a hyphen. `\p{L}`/`\p{N}` need the `u` flag.
 */
const SEPARATORS = /[\s،؛؟_/\\|,.;:!?'"“”‘’()[\]{}<>@#$%^&*+=~`]+/gu;
const NON_SLUG = /[^\p{L}\p{N}-]+/gu;

/** Deterministic slug. Same input always gives the same output — no random suffix. */
export const slugifyFunction = (input) =>
  String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(SEPARATORS, '-')
    .replace(NON_SLUG, '')
    .replace(/-{2,}/g, '-')
    .replace(/(^-|-$)/g, '');

/**
 * Resolve the slug to persist, guaranteeing uniqueness within a collection.
 *
 * The admin may set the slug explicitly — that is a CMS requirement, because the URL is
 * content, not a derived value, and an editor renaming a page title must not silently
 * break its inbound links. When they don't, it derives from the title.
 *
 * Uniqueness is by collision suffix (`-2`, `-3`) rather than an unconditional random
 * tail, so the common case yields the clean, predictable URL the admin expects.
 *
 * @param {string} modelName  registered Mongoose model
 * @param {string} desired    admin-supplied slug, if any
 * @param {string} fallback   source text to derive from (usually the title)
 * @param {string} [excludeId] document being updated, so it doesn't collide with itself
 */
export const resolveSlug = async (modelName, desired, fallback, excludeId = null) => {
  const base = slugifyFunction(desired || fallback);

  // Every title was punctuation, or empty. Better a stable timestamp than a blank URL.
  if (!base) return `item-${Date.now().toString(36)}`;

  const Model = mongoose.model(modelName);
  const query = (slug) => {
    const q = { slug };
    if (excludeId) q._id = { $ne: excludeId };
    return Model.exists(q);
  };

  if (!(await query(base))) return base;

  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base}-${n}`;
    if (!(await query(candidate))) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
};
