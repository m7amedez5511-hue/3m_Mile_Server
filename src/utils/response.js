/**
 * Send a standardized JSON response for success cases.
 * @param {Object} res - Express response object
 * @param {Number} statusCode - HTTP status code
 * @param {String} message - Message to be sent
 * @param {Object} [data=null] - Optional data payload
 */
export const sendResponse = (res, statusCode, message, data = null) => {
    return res.status(statusCode).json({
        success: true,
        message: message,
        responseAt: new Date(),
        data: data,
    });
};

