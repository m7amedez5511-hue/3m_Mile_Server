import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { deleteImage as deleteCloudinaryImage } from '../utils/Cloudinary.config.js';
import { slugifyFunction } from '../utils/buildSlugify.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';
import { logger } from '../utils/winston.js';
import { safeDeleteCloudinaryImage } from '../utils/softDeleteImage.js';

const blogPostCrud = crudService('BlogPost');

const MAX_PAGE_LIMIT = 100;



// get all blog posts with pagination, search, and filter by isPublished
export const listBlogPosts = async ({ page = 1, limit = 10, search, isPublished } = {}) => {
  //1 build filter object
  const filter = { isDeleted: false };
  if (search) filter.title = { $regex: search, $options: 'i' };
  if (isPublished !== undefined) filter.isPublished = isPublished;

  //2 clamp pagination params so nobody can request e.g. limit=999999
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(MAX_PAGE_LIMIT, Math.max(1, Number(limit) || 10));

  //3 fetch paginated results with author populated
  return blogPostCrud.findAndCountAll(filter, {
    page: safePage,
    limit: safeLimit,
    sort: { publishedAt: -1, createdAt: -1 },
    populate: [{ path: 'author', select: ['fullName'] }],
  });
};
// get a single blog post by ID with author populated
export const getBlogPostById = async (id) => {
  //1 fetch the blog post by ID and populate the author field
  const post = await blogPostCrud.findByPk(id, { populate: [{ path: 'author', select: ['fullName'] }] });
  if (!post || post.isDeleted) {
    throw createAppError(404, 'blog_post_not_found');
  }
  //2 return the blog post
  return post;
};
// create a new blog post with optional cover image upload
export const createBlogPost = async (req) => {
  //1 validate required fields
  const { title, excerpt, content, tags, isPublished } = req.body;
  const data = {
    title,
    slug: slugifyFunction(title),
    excerpt,
    content,
    tags,
    author: req.user._id || req.user.id,
    isPublished: isPublished ?? false,
    publishedAt: isPublished ? new Date() : null,
  };
  //2 handle cover image upload if present and uploade image to Cloudinary
  if (req.uploadedFile) {
    data.coverImage = { url: req.uploadedFile.url, imagePublicId: req.uploadedFile.publicId };
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
  //2 prepare the update data and handle cover image upload if present
  const data = { ...req.body };
  if (data.title) data.slug = slugifyFunction(data.title);
  if (data.isPublished && !existing.isPublished) data.publishedAt = new Date();

  if (req.uploadedFile) {
    data.coverImage = { url: req.uploadedFile.url, imagePublicId: req.uploadedFile.publicId };
    // await + log instead of fire-and-forget, so a failed cleanup
    // is visible instead of disappearing silently
    if (existing.coverImage?.imagePublicId) {
      await safeDeleteCloudinaryImage(existing.coverImage.imagePublicId, { id, action: 'UPDATE' });
    }
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