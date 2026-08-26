import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import {
  listBlogPosts,
  getBlogPostById,
  getBlogPostBySlug,
  createBlogPost as createBlogPostService,
  updateBlogPost as updateBlogPostService,
  deleteBlogPost as deleteBlogPostService,
} from '../services/blogPost.service.js';
// get all blog posts with pagination, search, and filter by isPublished/category
export const getBlogPosts = asyncHandler(async (req, res) => {
  //1 extract query parameters for pagination, search, and filters
  const { page, limit, search, isPublished, category } = req.query;
  //2 fetch the paginated list of blog posts using the service function
  const result = await listBlogPosts({
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    search,
    isPublished: isPublished !== undefined ? isPublished === 'true' : undefined,
    category,
  });
  //3 send the response with the fetched blog posts
  return sendResponse(res, 200, 'blog_posts_fetched', result);
});
// get a single blog post by slug — the public site's lookup path
export const getBlogPostBySlugHandler = asyncHandler(async (req, res) => {
  //1 fetch the blog post by slug using the service function
  const post = await getBlogPostBySlug(req.params.slug);
  //2 send the response with the fetched blog post
  return sendResponse(res, 200, 'blog_post_fetched', post);
});
// get a single blog post by ID
export const getBlogPost = asyncHandler(async (req, res) => {
  //1 fetch the blog post by ID using the service function
  const post = await getBlogPostById(req.params.id);
  //2 send the response with the fetched blog post
  return sendResponse(res, 200, 'blog_post_fetched', post);
});
// create a new blog post with optional cover image upload
export const createBlogPost = asyncHandler(async (req, res) => {
  //1 create the blog post using the service function
  const post = await createBlogPostService(req);
  //2 send the response with the created blog post
  return sendResponse(res, 201, 'blog_post_created', post);
});
// update an existing blog post by ID with optional cover image upload
export const updateBlogPost = asyncHandler(async (req, res) => {
  //1 update the blog post using the service function
  const post = await updateBlogPostService(req.params.id, req);
  //2 send the response with the updated blog post
  return sendResponse(res, 200, 'blog_post_updated', post);
});
// delete a blog post by ID and remove its cover image from Cloudinary if present
export const deleteBlogPost = asyncHandler(async (req, res) => {
  //1 delete the blog post using the service function
  await deleteBlogPostService(req.params.id, req);
  //2 send the response indicating successful deletion
  return sendResponse(res, 200, 'blog_post_deleted', null);
});
