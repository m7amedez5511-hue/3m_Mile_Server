import { z } from 'zod';

/**
 * Coercion helpers for multipart/form-data.
 *
 * A `multipart/form-data` body is all strings — there are no booleans, numbers, arrays
 * or objects on the wire. The admin dashboard has to send multipart whenever a request
 * carries a file, so every non-string field arrives as its string form and has to be
 * coerced back before validation. These are the shared coercions; keeping them in one
 * place is what stops each resource inventing its own slightly different rules.
 */

/** `true` / `false` as sent by a checkbox, or a real boolean from a JSON body. */
export const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true');

/** A list of plain strings, sent either as a real array or comma-separated. */
export const listish = z
  .union([z.array(z.string()), z.string()])
  .transform((v) =>
    Array.isArray(v) ? v : v.split(',').map((s) => s.trim()).filter(Boolean),
  );

/**
 * A structured value (array of objects, nested object) sent as a JSON string.
 *
 * Passing the schema in keeps the error message pointing at the real field rather than
 * a generic "invalid JSON": the parse failure and the shape failure both surface as
 * validation errors on the same path.
 */
export const jsonish = (schema) =>
  z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    try {
      return JSON.parse(v);
    } catch {
      // Let the wrapped schema produce the type error — it names the field.
      return v;
    }
  }, schema);

/** Numbers arrive as strings from multipart. */
export const numberish = z.coerce.number();

/** A slug the admin typed. Empty string means "derive it from the title". */
export const slugish = z
  .string()
  .trim()
  .max(200)
  // Letters/numbers in any script (the site's URLs are Arabic), plus hyphens.
  .regex(/^[\p{L}\p{N}-]*$/u, 'slug may contain only letters, numbers and hyphens');

/** A title/body pair, used by service intro points and benefit cards. */
export const titleBody = z.object({
  title: z.string().max(200).default(''),
  body: z.string().max(2000).default(''),
});
