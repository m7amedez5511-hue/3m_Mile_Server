import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { uploadImage } from './Cloudinary.config.js';
import { logger } from './winston.js';

// Custom error class for file upload errors
class FileUploadError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'FileUploadError';
    }
}

// Using imported uploadImage from cloudinary service

// Cloudinary delete function
const deleteImage = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        logger.error('Cloudinary delete error:', error);
        throw new FileUploadError('Failed to delete image', 500);
    }
};

// Cloudinary get info function
const getImageInfo = async (publicId) => {
    try {
        const result = await cloudinary.api.resource(publicId);
        return result;
    } catch (error) {
        logger.error('Cloudinary get info error:', error);
        throw new FileUploadError('Failed to get image info', 500);
    }
};

// Extract public ID from Cloudinary URL
const extractPublicId = (imageUrl) => {
    try {
        const urlParts = imageUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        const publicId = filename.split('.')[0];
        return publicId;
    } catch (error) {
        logger.error('Error extracting public ID:', error);
        throw new FileUploadError('Failed to extract public ID', 500);
    }
};

// File type configurations
const allowedMimeTypes = {
    image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    // Browsers send video/quicktime for .mov, video/x-msvideo for .avi and
    // video/x-ms-wmv for .wmv — the bare `video/mov`/`video/avi` forms never occur.
    video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv']
};

const fileSizeLimits = {
    small: 1024 * 1024,      // 1MB
    medium: 5 * 1024 * 1024, // 5MB
    large: 10 * 1024 * 1024, // 10MB
    extraLarge: 50 * 1024 * 1024 // 50MB
};

// Create file filter function
function createFileFilter(allowedTypes) {
    return (req, file, cb) => {
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new FileUploadError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
        }
    };
}

// Create uploader function
export function createUploader(options = {}) {
    const {
        allowedTypes = allowedMimeTypes.image,
        fileSizeLimit = fileSizeLimits.medium,
        maxFiles = 1
    } = options;

    const fileFilter = createFileFilter(allowedTypes);

    return multer({
        storage: multer.memoryStorage(),
        fileFilter: fileFilter,
        limits: {
            fileSize: fileSizeLimit,
            files: maxFiles
        }
    });
}

// Pre-configured uploaders for common use cases
export const uploaders = {
    // Product images (single image)
    productImage: createUploader({
        allowedTypes: allowedMimeTypes.image,
        fileSizeLimit: fileSizeLimits.medium,
        maxFiles: 1
    }),

    // Product images (multiple images)
    productImages: createUploader({
        allowedTypes: allowedMimeTypes.image,
        fileSizeLimit: fileSizeLimits.medium,
        maxFiles: 10
    }),

    // User profile images
    profileImage: createUploader({
        allowedTypes: allowedMimeTypes.image,
        fileSizeLimit: fileSizeLimits.small,
        maxFiles: 1
    }),

    // Category images
    categoryImage: createUploader({
        allowedTypes: allowedMimeTypes.image,
        fileSizeLimit: fileSizeLimits.small,
        maxFiles: 1
    }),

    // Banner images
    bannerImage: createUploader({
        allowedTypes: allowedMimeTypes.image,
        fileSizeLimit: fileSizeLimits.large,
        maxFiles: 1
    }),

    // Documents (for orders, invoices, etc.)
    document: createUploader({
        allowedTypes: allowedMimeTypes.document,
        fileSizeLimit: fileSizeLimits.medium,
        maxFiles: 1
    }),

    // Videos (for product demos, etc.)
    video: createUploader({
        allowedTypes: allowedMimeTypes.video,
        fileSizeLimit: fileSizeLimits.extraLarge,
        maxFiles: 1
    }),

    // Gallery PUT /:id — accepts image OR video in one field, since the item's
    // real type isn't known until it's fetched from the DB (checked in the service)
    galleryMedia: createUploader({
        allowedTypes: [...allowedMimeTypes.image, ...allowedMimeTypes.video],
        fileSizeLimit: fileSizeLimits.extraLarge,
        maxFiles: 1
    })
};

// Single-endpoint gallery create: detects image vs video from mimetype,
// uploads to the matching gallery folder, and attaches { mediaType, uploadedFile } to req
export const uploadGalleryMediaToCloudinary = async (req, res, next) => {
    try {
        // No file is a legitimate request now: a YouTube reel is identified by
        // `externalId` and has no asset to upload. The service decides whether the
        // combination it received is valid — this middleware only handles uploads.
        if (!req.file) {
            return next();
        }

        const isImage = allowedMimeTypes.image.includes(req.file.mimetype);
        const isVideo = allowedMimeTypes.video.includes(req.file.mimetype);
        const mediaType = isImage ? 'image' : isVideo ? 'video' : null;

        // galleryMedia uploader's fileFilter already restricts mimetypes, this is a safety net
        if (!mediaType) {
            return next(new FileUploadError('Unsupported file type for gallery item', 400));
        }

        const folder = mediaType === 'image' ? '3mmile/gallery/images' : '3mmile/gallery/videos';

        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;

        logger.info(`Uploading gallery ${mediaType} to Cloudinary folder: ${folder}`);

        const result = await uploadImage(dataURI, folder, {
            public_id: `${Date.now()}_${Math.random().toString(36).substring(7)}`,
            resource_type: mediaType,
        });

        req.mediaType = mediaType;   // 'image' | 'video' — resolved from the actual file, not trusted from body
        req.uploadedFile = result;   // { publicId, url, ... }
        next();
    } catch (error) {
        logger.error('Error in uploadGalleryMediaToCloudinary:', error);
        next(new FileUploadError(`Upload failed: ${error.message}`, 500));
    }
};

// Middleware to handle file upload to Cloudinary
export const uploadToCloudinary = (folder = 'theshop') => {
    return async (req, res, next) => {
        try {
            if (!req.files && !req.file) {
                return next();
            }

            const files = req.files || [req.file];
            logger.info(`Uploading ${files.length} file(s) to Cloudinary folder: ${folder}`);
            
            const uploadPromises = files.map(async (file) => {
                logger.debug(`Processing file: ${file.originalname} (${file.mimetype}, ${file.size} bytes)`);
                
                // Convert buffer to base64 for cloudinary
                const b64 = Buffer.from(file.buffer).toString('base64');
                const dataURI = `data:${file.mimetype};base64,${b64}`;
                
                const result = await uploadImage(dataURI, folder, {
                    public_id: `${Date.now()}_${Math.random().toString(36).substring(7)}`,
                    resource_type: 'auto'
                });
                
                logger.debug(`File uploaded successfully: ${result.public_id}`);
                return result;
            });

            const results = await Promise.all(uploadPromises);
            logger.info(`Successfully uploaded ${results.length} file(s) to Cloudinary`);
            
            // Attach upload results to request
            if (req.files) {
                req.uploadedFiles = results;
            } else {
                req.uploadedFile = results[0];
            }

            next();
        } catch (error) {
            logger.error('Error in uploadToCloudinary:', error);
            next(new FileUploadError(`Upload failed: ${error.message}`, 500));
        }
    };
};

/**
 * Upload errors, normalised onto the API's error envelope: a snake_case code the client
 * can translate, with the original English prose kept on `details` for the log.
 */
const MULTER_CODES = {
    LIMIT_FILE_SIZE: 'file_too_large',
    LIMIT_FILE_COUNT: 'too_many_files',
    LIMIT_UNEXPECTED_FILE: 'unexpected_file_field',
    LIMIT_PART_COUNT: 'too_many_files',
    LIMIT_FIELD_COUNT: 'too_many_files',
};

export const handleMulterError = (err, req, res, next) => {
    const asCode = (code, status, original, field) => {
        const error = new FileUploadError(code, status);
        error.code = code;
        error.details = [{ field: field || 'file', code: original }];
        return error;
    };

    if (err instanceof multer.MulterError) {
        return next(asCode(MULTER_CODES[err.code] || 'upload_failed', 400, err.message, err.field));
    }

    // A rejected mime type arrives with English prose from createFileFilter/slotUploader.
    if (err instanceof FileUploadError || err?.name === 'SlotUploadError') {
        return next(asCode('file_type_not_allowed', err.statusCode || 400, err.message));
    }

    next(err);
};

// Utility function to delete file from Cloudinary
export const deleteFromCloudinary = async (imageUrl) => {
    try {
        const publicId = extractPublicId(imageUrl);
        const result = await deleteImage(publicId);
        logger.info(`Successfully deleted file from Cloudinary: ${publicId}`);
        return result;
    } catch (error) {
        logger.error('Error deleting file from Cloudinary:', error);
        throw new FileUploadError('Failed to delete file', 500);
    }
};

// Utility function to get file info from Cloudinary
export const getFileInfo = async (imageUrl) => {
    try {
        const publicId = extractPublicId(imageUrl);
        const result = await getImageInfo(publicId);
        return result;
    } catch (error) {
        logger.error('Error getting file info from Cloudinary:', error);
        throw new FileUploadError('Failed to get file info', 500);
    }
};

// Utility function to delete multiple files from Cloudinary
export const deleteMultipleFromCloudinary = async (imageUrls) => {
    try {
        const publicIds = imageUrls.map(url => extractPublicId(url));
        const result = await cloudinary.api.delete_resources(publicIds);
        logger.info(`Successfully deleted ${publicIds.length} files from Cloudinary`);
        return result;
    } catch (error) {
        logger.error('Error deleting multiple files from Cloudinary:', error);
        throw new FileUploadError('Failed to delete multiple files', 500);
    }
};

// Utility function to extract public ID from Cloudinary URL
export const getPublicIdFromUrl = (imageUrl) => {
    try {
        return extractPublicId(imageUrl);
    } catch (error) {
        logger.error('Error extracting public ID from URL:', error);
        throw new FileUploadError('Failed to extract public ID', 500);
    }
};