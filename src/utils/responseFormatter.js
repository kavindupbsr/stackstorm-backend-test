/**
 * StackStorm API Standard Response Formatter
 * Adheres strictly to project JSON:API response envelope standards:
 * {
 *   "success": boolean,
 *   "data": object | array | null,
 *   "message": string,
 *   "errors": array
 * }
 */

/**
 * Sends a standardized success HTTP response.
 *
 * @param {import('express').Response} res - Express response object
 * @param {any} [data=null] - The payload data
 * @param {string} [message='Success'] - Human-readable descriptive feedback
 * @param {number} [statusCode=200] - HTTP status code
 * @returns {import('express').Response}
 */
const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    errors: [],
  });
};

/**
 * Sends a standardized error HTTP response.
 *
 * @param {import('express').Response} res - Express response object
 * @param {string} [message='An error occurred'] - Human-readable error message
 * @param {Array<any>} [errors=[]] - Array of error details or validation failures
 * @param {number} [statusCode=500] - HTTP status code
 * @returns {import('express').Response}
 */
const errorResponse = (res, message = 'An error occurred', errors = [], statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    data: null,
    message,
    errors: Array.isArray(errors) ? errors : [errors],
  });
};

module.exports = {
  successResponse,
  errorResponse,
};
