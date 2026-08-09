import { asyncHandler } from '../middleware/errorHandler.js';
import { createBlogPostService } from '../services/blogPost.service.js';
import { sendResponse } from '../utils/response.js';


//create a new blog post
export const createBlogPost = asyncHandler(async (req, res) => {
    const { title, content } = req.body;
    
    //use service layer to create a new blog post
    const newBlogPost = await createBlogPostService({ title, content }, req);
    return sendResponse(res, 201, 'blog_post_created', newBlogPost);
})