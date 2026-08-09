import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
// NOTE: this package is not in the files you uploaded, install it with:
//   npm install sanitize-html
// It's the missing piece for #5 (stored XSS via `content`).

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
  excerpt: z.string().max(300).optional(),
  content: z.string().min(1).transform(sanitizeContent),
  tags: tagsish,
  isPublished: booleanish,
});

export const updateBlogPostSchema = createBlogPostSchema.partial();