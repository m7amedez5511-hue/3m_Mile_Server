import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';

const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true')
  .optional();

const tagsish = z
  .union([z.array(z.string()), z.string()])
  .transform((v) => (Array.isArray(v) ? v : v.split(',').map((t) => t.trim()).filter(Boolean)))
  .optional();

// allow a reasonable rich-text subset (what a blog editor like
// TipTap/Quill/CKEditor would normally output) and strip everything else,
// including <script>, inline event handlers (onclick etc.), and iframes.
const sanitizeContent = (html) =>
  sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'b', 'i', 'em', 'strong', 'u', 's', 'a',
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'figure', 'figcaption',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });

export const createBlogPostSchema = z.object({
  title: z.string().min(2).max(200),
  // The admin owns the URL: renaming a post's title must not be able to break its
  // inbound links. Letters/numbers in any script, because the site's URLs are Arabic.
  slug: z.string().trim().max(200).regex(/^[\p{L}\p{N}-]*$/u, 'slug may contain only letters, numbers and hyphens').optional(),
  excerpt: z.string().max(300).optional(),
  content: z.string().min(1).transform(sanitizeContent),
  tags: tagsish,
  // Category ObjectIds. Sent as a real array from JSON, or comma-separated from a form.
  categories: z
    .union([z.array(z.string().length(24)), z.string()])
    .transform((v) => (Array.isArray(v) ? v : v.split(',').map((c) => c.trim()).filter(Boolean)))
    .optional(),
  coverImageAlt: z.string().max(300).optional(),
  isPublished: booleanish,
});

export const updateBlogPostSchema = createBlogPostSchema.partial();