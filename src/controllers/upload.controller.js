const crypto = require('crypto');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { CDN_BASE_URL } = require('../config/s3');

/**
 * Controller for handling product and review image uploads.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware
 */
const uploadImages = async (req, res, next) => {
  try {
    const { files } = req;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return errorResponse(
        res,
        'No files were uploaded. Please provide an image file under the "images" field.',
        [],
        400
      );
    }

    const urls = files.map((file) => {
      if (file.location) {
        return file.location;
      }

      const extension = file.originalname ? file.originalname.split('.').pop() : 'webp';
      const key = file.key || `products/${crypto.randomUUID()}.${extension}`;
      return `${CDN_BASE_URL}/${key}`;
    });

    return successResponse(res, { urls }, 'Images uploaded successfully', 201);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadImages,
};
