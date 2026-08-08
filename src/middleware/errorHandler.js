import config from 'config';
import { logger } from '../utils/winston.js';
import { ERROR_TYPES, defaultMessages } from '../constants/errors.constant.js';

/**
 * Format Joi validation errors
 * @param {Object} error - Joi validation error
 * @returns {Array} Array of formatted error messages
 */
const formatJoiErrors = (error) => {
  if (error.details && Array.isArray(error.details)) {
    return error.details.map(detail => ({
      field: detail.path.join('.'),
      code: detail.message
    }));
  }
  return null;
};

/**
 * Format Zod validation errors
 * @param {Object} error - Zod validation error
 * @returns {Array} Array of formatted error messages
 */
const formatZodErrors = (error) => {
  const issues = error.issues || error.errors;
  if (issues && Array.isArray(issues)) {
    return issues.map(err => ({
      field: err.path.join('.'),
      code: err.message
    }));
  }
  return null;
};

/**
 * Format Mongoose validation errors
 * @param {Object} error - Mongoose validation error
 * @returns {Array} Array of formatted error messages
 */
const formatMongooseErrors = (error) => {
  if (error.errors) {
    return Object.keys(error.errors).map(key => ({
      field: key,
      code: error.errors[key].message
    }));
  }
  return null;
};

/**
 * Determine the appropriate HTTP status code for an error
 * @param {Object} error - The error object
 * @returns {number} HTTP status code
 */
const getErrorStatus = (error) => {
  // Check for validation errors first
  if (error.isJoi || error.name === 'ZodError' || error.name === 'ValidationError') {
    return 400;
  }

  // Check for MongoDB duplicate key error
  if (error.code === 11000) return ERROR_TYPES['ConflictError'];

  // If status is explicitly set, use it
  if (error.status) return error.status;
  if (error.statusCode) return error.statusCode;

  // Check for specific error types
  if (error.name) {
    return ERROR_TYPES[error.name] || 500;
  }

  // Default to 500
  return 500;
};

/**
 * Helper to check if current environment is development
 * @returns {boolean}
 */
const isDevelopmentEnv = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'dev' || env === 'development' || env === 'uat';
};

/**
 * Get user-friendly error code
 * @param {Object} error - The error object
 * @param {number} status - HTTP status code
 * @returns {string} Error code
 */
const getErrorCode = (error, status) => {
  // For Prisma errors
  if (error.code === 'P2002') {
    if (error.meta?.target && error.meta.target.length > 0) {
      const field = Array.isArray(error.meta.target) ? error.meta.target.join('_') : error.meta.target;
      return `${field}_already_exists`;
    }
    // Attempt to parse out of the error message if meta.target is missing
    if (error.message) {
      const fieldMatch = error.message.match(/fields?: \(`([^`]+)`\)/i);
      if (fieldMatch && fieldMatch[1]) {
        return `${fieldMatch[1].replace(/`/g, '')}_already_exists`;
      }
      const constraintMatch = error.message.match(/constraint: ['"`]([^'"`]+)['"`]/i);
      if (constraintMatch && constraintMatch[1]) {
        let field = constraintMatch[1];
        if (field.includes('_')) {
           const parts = field.split('_');
           if (parts.length >= 3) field = parts[parts.length - 2]; 
        }
        return `${field}_already_exists`;
      }
    }
    return `record_already_exists`;
  }

  if (error.code === 'P2003') {
    return 'foreign_key_constraint_failed';
  }

  if (error.code === 'P2025') {
    return 'resource_not_found';
  }

  // Joi or Zod validation errors
  if (error.isJoi || error.name === 'ZodError') {
    return 'validation_failed';
  }

  // For Mongoose validation errors
  if (error.name === 'ValidationError') {
    return 'validation_failed';
  }

  // For MongoDB duplicate key errors
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];    
    return field ? `${field}_already_exists` : 'duplicate_entry';
  }

  // For Mongoose CastError (invalid ObjectId)
  if (error.name === 'CastError') {
    return 'Invalid resource identifier';
  }

  // For JWT errors
  if (error.name === 'JsonWebTokenError') {
    return 'invalid_token';
  }

  if (error.name === 'TokenExpiredError') {
    return 'token_expired';
  }

  // Use error message if available
  if (error.code && typeof error.code === 'string') {
    return error.code;
  }

  return 'internal_error';
};

/**
 * Get user-friendly error message
 * @param {Object} error - The error object
 * @param {number} status - HTTP status code
 * @returns {string} User-friendly error message
 */
const getFriendlyMessage = (error, status) => {
  const isDevelopment = isDevelopmentEnv();

  if (error.code === 'P2002') {
    if (error.meta?.target && error.meta.target.length > 0) {
      const field = Array.isArray(error.meta.target) ? error.meta.target.join(' and ') : error.meta.target;
      return `A record with this ${field} already exists.`;
    }
    if (error.message) {
      const fieldMatch = error.message.match(/fields?: \(`([^`]+)`\)/i);
      if (fieldMatch && fieldMatch[1]) {
        return `A record with this ${fieldMatch[1].replace(/`/g, '').replace(/,/g, ' and ')} already exists.`;
      }
      const constraintMatch = error.message.match(/constraint: ['"`]([^'"`]+)['"`]/i);
      if (constraintMatch && constraintMatch[1]) {
        let field = constraintMatch[1];
        if (field.includes('_')) {
           const parts = field.split('_');
           if (parts.length >= 3) field = parts[parts.length - 2]; 
        }
        return `A record with this ${field} already exists.`;
      }
    }
    return 'A record with these details already exists.';
  }

  if (error.code === 'P2003') {
    return 'A related record could not be found or a constraint failed.';
  }

  if (error.code === 'P2025') {
    return 'The requested resource was not found.';
  }

  if (error.isJoi || error.name === 'ZodError') {
    let details = '';
    if (error.isJoi && error.details?.length > 0) {
      details = `: ${error.details[0].path.join('.')} (${error.details[0].message})`;
    } else if (error.name === 'ZodError' && (error.issues || error.errors)?.length > 0) {
      const issue = (error.issues || error.errors)[0];
      details = `: ${issue.path.join('.')} (${issue.message})`;
    }
    return `Validation failed${details}.`;
  }

  if (error.code === 11000) {
    return 'A duplicate entry was found.';
  }

  if (error.name === 'JsonWebTokenError') {
    return 'Invalid authentication token. Please log in again.';
  }

  if (error.name === 'TokenExpiredError') {
    return 'Authentication token expired. Please log in again.';
  }

  if (error.message) {
    if (!isDevelopment && status === 500) {
      return 'An internal server error occurred.';
    }
    return error.message;
  }

  return defaultMessages[status] || 'An error occurred';
};

/**
 * Log error details
 * @param {Object} error - The error object
 * @param {Object} req - Express request object
 * @param {number} status - HTTP status code
 */
const logError = (error, req, status) => {
  const logLevel = status >= 500 ? 'error' : 'warn';

  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    status,
    message: error.message,
    name: error.name,
    code: error.code,
    user: req.user?.id || 'anonymous',
    ip: req.ip || req.connection.remoteAddress
  };

  // Add stack trace for 500 errors
  if (status >= 500) {
    errorLog.stack = error.stack;
  }

  // Add validation details for validation errors
  if (error.isJoi || error.name === 'ZodError' || error.name === 'ValidationError') {
    errorLog.validationErrors = error.isJoi
      ? formatJoiErrors(error)
      : error.name === 'ZodError'
      ? formatZodErrors(error)
      : formatMongooseErrors(error);
  }

  logger[logLevel](errorLog);
};

/**
 * Global error handling middleware
 * Catches all errors thrown in the application and formats them consistently
 *
 * @param {Object} error - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const errorHandler = (error, req, res, next) => {
  const isDevelopment = isDevelopmentEnv();

  // Determine status code
  const status = getErrorStatus(error);

  // Get user-friendly message
  const code = getErrorCode(error, status);
  const message = getFriendlyMessage(error, status);

  // Log the error
  logError(error, req, status);

  // Prepare error response
  const errorResponse = {
    success: false,
    message,
    responseAt: new Date(),
    error: {
      code,
      path: req.originalUrl,
      details: null
    }
  };

  // Add validation errors if present 
  if (error.isJoi) {
    errorResponse.error.details = formatJoiErrors(error);
  } else if (error.name === 'ZodError') {
    errorResponse.error.details = formatZodErrors(error);
  } else if (error.name === 'ValidationError') {
    errorResponse.error.details = formatMongooseErrors(error);
  } else if (error.details) {
    errorResponse.error.details = error.details;
  }

  // In development, include stack trace
  if (isDevelopment && status >= 500) {
    errorResponse.error.stack = error.stack;
    errorResponse.error.name = error.name;
    errorResponse.error.dbCode = error.code;
  }

  // Send error response
  res.status(status).json(errorResponse);
};

/**
 * 404 Not Found handler
 * Catches all requests that don't match any routes
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  error.name = 'NotFoundError';
  next(error);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 * Use this to wrap async controllers to automatically catch errors
 *
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 *
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await User.find();
 *   res.json(users);
 * }));
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {      
      next(err);
    });
  };
};

export {
  errorHandler,
  notFoundHandler,
  asyncHandler
};