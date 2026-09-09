/**
 * @param {unknown} input raw value straight off `req.query`
 * @returns {{ $regex: string, $options: string } | undefined}
 */
export const buildSearchRegex = (input) => {
  // A repeated query key (?search=a&search=b) arrives as an array.
  const raw = Array.isArray(input) ? input[0] : input;
  if (typeof raw !== 'string') return undefined;

  // Cap the length so a huge pattern cannot be used to burn CPU server-side.
  const trimmed = raw.trim().slice(0, 80);
  if (!trimmed) return undefined;

  // Escape every regex metacharacter — the value is matched literally.
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { $regex: escaped, $options: 'i' };
};
