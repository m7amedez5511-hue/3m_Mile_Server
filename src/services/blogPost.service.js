import crudService from './crud.service.js';
import { castObjectId } from '../helpers/db.helper.js';
import { createAppError } from '../utils/createAppError.js';
import { deleteImage as deleteCloudinaryImage } from '../utils/Cloudinary.config.js';
import { resolveSlug } from '../utils/buildSlugify.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';
import { logger } from '../utils/winston.js';
import { safeDeleteCloudinaryImage } from '../utils/softDeleteImage.js';

const blogPostCrud = crudService('BlogPost');

const MAX_PAGE_LIMIT = 100;

// whitelist of fields the client may set directly. Everything else — slug, author,
// coverImage, isDeleted, publishedAt — is derived server-side.
const UPDATABLE_FIELDS = ['title', 'excerpt', 'content', 'tags', 'categories', 'isPublished'];

const POPULATE = [
  { path: 'author', localField: 'author', collection: 'users', select: ['fullName'] },
  { path: 'categories', localField: 'categories', collection: 'categories', select: ['name', 'slug'] },
];

// get all blog posts with pagination, search, and filter by isPublished/category
export const listBlogPosts = async ({ page = 1, limit = 10, search, isPublished, category } = {}) => {
  //1 build filter object
  const filter = { isDeleted: false };
  if (search) filter.title = { $regex: search, $options: 'i' };
  if (isPublished !== undefined) filter.isPublished = isPublished;
  //2 category archives are addressed by ObjectId; the frontend resolves the slug to an
  //  id first via /categories/slug/:slug
  //  (cast to ObjectId — the populated list goes through aggregation $match, which does no casting;
  //  a scalar ObjectId in $match matches array elements of `categories`)
  if (category) filter.categories = castObjectId(category);

  //3 clamp pagination params so nobody can request e.g. limit=999999
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(MAX_PAGE_LIMIT, Math.max(1, Number(limit) || 10));

  //4 fetch paginated results with author and categories populated
  return blogPostCrud.findAndCountAll(filter, {
    page: safePage,
    limit: safeLimit,
    sort: { publishedAt: -1, createdAt: -1 },
    populate: POPULATE,
  });
};

/**
 * Get a single post by slug.
 *
 * Blog posts live at the site root (`/{slug}`), so slug is the only identifier the
 * frontend ever has for a post.
 */
export const getBlogPostBySlug = async (slug) => {
  //1 fetch by slug with author and categories populated
  const post = await blogPostCrud.findOne({ slug, isDeleted: false }, { populate: POPULATE });
  //2 if not found, throw a 404 error
  if (!post) {
    throw createAppError(404, 'blog_post_not_found');
  }
  //3 return the post
  return post;
};
// get a single blog post by ID with author populated
export const getBlogPostById = async (id) => {
  //1 fetch the blog post by ID and populate the author field
  const post = await blogPostCrud.findByPk(id, {
  populate: [{ path: 'author', localField: 'author', collection: 'users', select: ['fullName'] }],
});
  if (!post || post.isDeleted) {
    throw createAppError(404, 'blog_post_not_found');
  }
  //2 return the blog post
  return post;
};
// create a new blog post with optional cover image upload
export const createBlogPost = async (req) => {
  //1 build the document from the validated body
  const { title, isPublished } = req.body;
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  data.author = req.user._id || req.user.id;
  data.isPublished = isPublished ?? false;
  data.publishedAt = isPublished ? new Date() : null;
  //2 resolve the slug — admin-supplied wins, otherwise derived from the title
  data.slug = await resolveSlug('BlogPost', req.body.slug, title);
  //3 handle cover image upload if present and upload image to Cloudinary
  if (req.uploadedFile) {
    data.coverImage = {
      url: req.uploadedFile.url,
      imagePublicId: req.uploadedFile.publicId,
      alt: req.body.coverImageAlt || '',
      width: req.uploadedFile.width ?? null,
      height: req.uploadedFile.height ?? null,
    };
  }
  //3 create the blog post and log audit
  const post = await blogPostCrud.create(data);
  logAudit({ ...actorFromReq(req), action: 'CREATE', resource: 'BlogPost', details: { id: post._id, title } });
  //4 return the created blog post
  return post;
};
// update an existing blog post by ID with optional cover image upload
export const updateBlogPost = async (id, req) => {
  //1 fetch the existing blog post by ID
  const existing = await blogPostCrud.findByPk(id);
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'blog_post_not_found');
  }
  //2 build update data from a strict whitelist only.
  //  Spreading req.body here would let a client set isDeleted, author, slug or
  //  coverImage directly — every other resource in this codebase whitelists, and a
  //  post is no different.
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  //2a only re-slug when the admin explicitly changes it. Deriving a new slug from a
  //  retitled post would silently 404 every existing inbound link to it.
  if (req.body.slug !== undefined) {
    data.slug = await resolveSlug('BlogPost', req.body.slug, req.body.title || existing.title, id);
  }
  if (data.isPublished && !existing.isPublished) data.publishedAt = new Date();

  if (req.uploadedFile) {
    data.coverImage = {
      url: req.uploadedFile.url,
      imagePublicId: req.uploadedFile.publicId,
      alt: req.body.coverImageAlt ?? existing.coverImage?.alt ?? '',
      width: req.uploadedFile.width ?? null,
      height: req.uploadedFile.height ?? null,
    };
    // await + log instead of fire-and-forget, so a failed cleanup
    // is visible instead of disappearing silently
    if (existing.coverImage?.imagePublicId) {
      await safeDeleteCloudinaryImage(existing.coverImage.imagePublicId, { id, action: 'UPDATE' });
    }
  } else if (req.body.coverImageAlt !== undefined && existing.coverImage?.url) {
    // Alt text without a new upload — a dotted patch, leaving the rest of the slot alone.
    data['coverImage.alt'] = req.body.coverImageAlt;
  }
  //3 update the blog post and log audit
  const updated = await blogPostCrud.findOneAndUpdate({ _id: id }, data);
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'BlogPost', details: { id } });
  //4 return the updated blog post
  return updated;
};
// soft-delete a blog post by ID.
// NOTE: the cover image is deliberately NOT removed from Cloudinary here.
// A soft-deleted post can still be restored later (isDeleted: false), and
// if we'd already destroyed the image on Cloudinary the restore would be
// broken. Cloudinary cleanup should happen from a separate "permanently
// delete" / purge flow, not from this soft-delete.
export const deleteBlogPost = async (id, req) => {
  //1 fetch the existing blog post by ID
  const existing = await blogPostCrud.findByPk(id);
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'blog_post_not_found');
  }
  //2 mark the blog post as deleted instead of removing it from the database
  const result = await blogPostCrud.findOneAndUpdate(
    { _id: id },
    { isDeleted: true, deletedAt: new Date() },
  );
  logAudit({ ...actorFromReq(req), action: 'DELETE', resource: 'BlogPost', details: { id } });
  //3 return the soft-deleted blog post
  return result;
};