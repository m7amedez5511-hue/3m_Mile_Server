// utils/replaceCloudinaryMedia.js

import { logger } from './winston.js';
import { deleteImage, uploadImage } from './Cloudinary.config.js';

/**
 * Uploads a new file to Cloudinary, then deletes the old one if upload succeeds.
 * @param {Object} params
 * @param {Object} params.file        - req.file from multer (memoryStorage)
 * @param {string} params.folder      - upload folder, e.g. '3mmile/gallery/videos'
 * @param {'image'|'video'} params.resourceType
 * @param {string|null} params.oldPublicId - old publicId to be deleted
 */
export const replaceCloudinaryMedia = async ({ file, folder, resourceType, oldPublicId }) => {
  // 1. Convert multer memoryStorage buffer to base64 data URI
  const b64 = Buffer.from(file.buffer).toString('base64');
  const dataURI = `data:${file.mimetype};base64,${b64}`;

  // 2. Upload new file first (if this fails, exception stops flow, old file stays intact)
  const uploaded = await uploadImage(dataURI, folder, {
    resource_type: resourceType,
    public_id: `${Date.now()}_${Math.random().toString(36).substring(7)}`,
  });

  // 3. Only after new file is confirmed live, delete the old one
  if (oldPublicId) {
    try {
      await deleteImage(oldPublicId, { resourceType });
    } catch (err) {
      // 4. New file already uploaded and DB update will proceed regardless,
      // so we must not fail the request over an orphan delete failure — just log for later cleanup
      logger.error(`Failed to delete old Cloudinary media ${oldPublicId}: ${err.message}`);
    }
  }

  return uploaded; // { publicId, url, width, height, format, bytes }
};