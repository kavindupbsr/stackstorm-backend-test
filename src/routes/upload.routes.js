const express = require('express');
const uploadController = require('../controllers/upload.controller');
const { upload } = require('../middleware/upload');
const authenticate = require('../middleware/authenticate');
const ApiError = require('../utils/ApiError');

const router = express.Router();

/**
 * Middleware handling Multer upload and translating Multer-specific limits into ApiErrors.
 *
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next middleware
 */
const handleUpload = (req, res, next) => {
  upload.array('images', 5)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(ApiError.badRequest('File too large. Maximum permitted file size is 5MB.'));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(ApiError.badRequest('Too many files. Maximum permitted file count is 5.'));
      }
      return next(err);
    }
    next();
  });
};

/**
 * @route   POST /api/v1/upload/images
 * @desc    Upload product or review images to S3 / Cloud Storage
 * @access  Private (Authenticated Users)
 */
router.post('/images', authenticate, handleUpload, uploadController.uploadImages);

module.exports = router;
