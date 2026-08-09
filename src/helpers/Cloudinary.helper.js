import cloudinary from '../config/cloudinary.config.js';
import { createAppError } from './createAppError.js';
import { logger } from './winston.js';

/**
 * cloudinary.helper.js
 * -----------------------------------------------------------------------
 * Central place for every Cloudinary operation (upload / update / delete).
 * Controllers and services should NEVER call the `cloudinary` SDK directly —
 * always go through these functions, so error handling, logging, and the
 * upload options (folder structure, transformations) stay consistent
 * across the whole app.
 *
 * Images arrive here as in-memory Buffers (multer.memoryStorage()) —
 * see src/middleware/upload.js. Nothing is ever written to local disk,
 * which is what makes this safe to run in production behind Docker/Nginx
 * without needing a persistent uploads volume.
 * -----------------------------------------------------------------------
 */

/**
 * Converts a multer in-memory file buffer into a Cloudinary-uploadable
 * base64 data URI. Cloudinary's SDK accepts this directly — no need for
 * an extra streaming library for typical image sizes (a few MB).
 */
const bufferToDataURI = (file) => {
  const base64 = file.buffer.toString('base64');
  return `data:${file.mimetype};base64,${base64}`;
};

/**
 * Upload a single image to Cloudinary.
 *
 * @param {Object} file - multer file object (from memoryStorage: has .buffer, .mimetype)
 * @param {string} folder - Cloudinary folder, e.g. "3mmile/products"
 * @param {Object} [options] - extra Cloudinary upload options (e.g. transformation)
 * @returns {Promise<{url: string, publicId: string, width: number, height: number, format: string}>}
 */
export const uploadImage = async (file, folder, options = {}) => {
  if (!file || !file.buffer) {
    throw createAppError(400, 'no_file_provided');
  }

  try {
    const dataURI = bufferToDataURI(file);

    const result = await cloudinary.uploader.upload(dataURI, {
      folder,
      resource_type: 'image',
      // Reasonable default: cap dimensions so a huge upload doesn't
      // blow up storage/bandwidth; keeps aspect ratio, never upscales.
      transformation: [{ width: 2000, height: 2000, crop: 'limit' }],
      ...options,
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (error) {
    logger.error('Cloudinary upload failed', { error: error.message, folder });
    throw createAppError(500, 'image_upload_failed');
  }
};

/**
 * Upload multiple images to Cloudinary in parallel.
 *
 * @param {Object[]} files - array of multer file objects
 * @param {string} folder - Cloudinary folder
 * @param {Object} [options] - extra Cloudinary upload options
 * @returns {Promise<Array<{url, publicId, width, height, format, bytes}>>}
 */
export const uploadMultipleImages = async (files, folder, options = {}) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw createAppError(400, 'no_files_provided');
  }

  try {
    return await Promise.all(files.map((file) => uploadImage(file, folder, options)));
  } catch (error) {
    // If any single upload fails, uploadImage() above already logs the
    // specific reason. Re-throw as-is if it's already an AppError.
    throw error;
  }
};

/**
 * Delete a single image from Cloudinary by its public_id.
 * Safe to call even if the image no longer exists — Cloudinary returns
 * result: "not found" instead of throwing, so we don't crash the request
 * just because someone already deleted the asset manually.
 *
 * @param {string} publicId - Cloudinary public_id (stored alongside the URL in your DB)
 */
export const deleteImage = async (publicId) => {
  if (!publicId) return { result: 'skipped_no_public_id' };

  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    return result;
  } catch (error) {
    logger.error('Cloudinary delete failed', { error: error.message, publicId });
    throw createAppError(500, 'image_delete_failed');
  }
};

/**
 * Delete multiple images from Cloudinary at once.
 * @param {string[]} publicIds
 */
export const deleteMultipleImages = async (publicIds = []) => {
  if (!Array.isArray(publicIds) || publicIds.length === 0) return { deleted: {} };

  try {
    return await cloudinary.api.delete_resources(publicIds, { resource_type: 'image' });
  } catch (error) {
    logger.error('Cloudinary bulk delete failed', { error: error.message, publicIds });
    throw createAppError(500, 'image_bulk_delete_failed');
  }
};

/**
 * Replace an existing image: uploads the new file FIRST, and only deletes
 * the old one after the new upload succeeds. This ordering matters — if we
 * deleted first and the new upload then failed (network error, invalid
 * file, etc.), the record would end up with no image at all. Uploading
 * first means a failed "update" simply leaves the old image untouched.
 *
 * @param {string|null} oldPublicId - public_id of the image being replaced (nullable for first-time uploads)
 * @param {Object} newFile - multer file object for the replacement image
 * @param {string} folder - Cloudinary folder
 * @param {Object} [options] - extra Cloudinary upload options
 * @returns {Promise<{url, publicId, width, height, format, bytes}>}
 */
export const updateImage = async (oldPublicId, newFile, folder, options = {}) => {
  const uploaded = await uploadImage(newFile, folder, options);

  if (oldPublicId) {
    // Best-effort cleanup — if this fails we still return success for the
    // new upload; log it so an orphaned asset can be cleaned up later.
    try {
      await deleteImage(oldPublicId);
    } catch (cleanupError) {
      logger.warn('Old image cleanup failed after successful update', {
        oldPublicId,
        error: cleanupError.message,
      });
    }
  }

  return uploaded;
};

export default {
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  deleteMultipleImages,
  updateImage,
};