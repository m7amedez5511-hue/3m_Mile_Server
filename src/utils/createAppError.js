/**
 * AppError Class to create operational errors with a status code
 */
export class AppError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Helper function to throw errors in a cleaner way
 * @param {number} status - HTTP status code (e.g., 400, 404, 401)
 * @param {string} code - Machine-readable error code (e.g., 'user_not_found')
 */
export const createAppError = (status, code) => {
  return new AppError(status, code);
};