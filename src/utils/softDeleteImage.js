// softDeleteImage.js
import { deleteImage as deleteCloudinaryImage } from './Cloudinary.config.js';
import { logger } from './winston.js';

// centralised, non-throwing Cloudinary cleanup so every call site
// behaves the same way (awaited + logged) instead of silently
// swallowing failures with .catch(() => {})
export const safeDeleteCloudinaryImage = async (publicId, context = {}) => {
  //1 nothing to delete if there's no publicId
  if (!publicId) return;
  //2 default to 'image' for backward compatibility, but let callers pass 'video'
  // (cloudinary destroy() defaults to resource_type 'image', so videos need it explicitly)
  const { resourceType = 'image', ...logContext } = context;
  //3 attempt deletion, log failure instead of swallowing it silently
  try {
    await deleteCloudinaryImage(publicId, { resourceType });
  } catch (error) {
    logger.error('Failed to delete Cloudinary image', {
      publicId,
      resourceType,
      error: error.message,
      ...logContext,
    });
  }
};