export const ERROR_TYPES = {
  /**
   * Error types and their corresponding HTTP status codes
   */
  PrismaClientValidationError: 400,
  PrismaClientKnownRequestError: 400, // Will be overridden by specific codes
  JsonWebTokenError: 401,      // JWT verification error
  TokenExpiredError: 401,      // JWT expired error
  UnauthorizedError: 401,      // General authentication error
  ForbiddenError: 403,         // Authorization error
  NotFoundError: 404,          // Resource not found
  ConflictError: 409,          // Duplicate resource
  ZodError: 400,               // Zod validation error
  ValidationError: 400         // Mongoose/General validation error
};

// Default messages based on status code
export const defaultMessages = {
  400: 'Bad request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Resource not found',
  409: 'Conflict',
  422: 'Unprocessable entity',
  500: 'Internal server error'
};

export const ASSET_ERRORS = {
  TOO_BIG: 'Asset size is too big.',
  TOO_MANY: 'Too many assets uploaded',
  ASSET_TYPE_NOT_SUPPORTED: 'Asset type not supported',
};
