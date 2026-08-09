import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { generateUniqueString } from '../utils/generate-Unique-String.js';
import { deleteImage as deleteCloudinaryImage } from '../utils/Cloudinary.config.js';
import { slugifyFunction } from '../utils/buildSlugify.js';

const blogPostCrud = crudService('BlogPost');


// newBlogPost
export const createBlogPostService = async(data , req) => {
    //1. slugify the title to create a unique slug
    const slug = slugifyFunction(data.title);
    //2. check if user send a cover image, if yes then add it to the data object
    if (req.file) {
        data.coverImage = {
            imagePublicId: req.file.public_id,
        };
    }
    //3. add the slug to the data object
    data.slug = slug;
    //4. create Audit fields log
    const auditCrud = crudService('AuditLog');
    await auditCrud.create({
    user: req.user.userId,
    action: 'CREATE',
    resource: 'BlogPost',
    details: { title: data.title },
    ip: req.ip,
  });
    //5. use the crud service to create a new blog post
    return await blogPostCrud.create(data);
    
}