const multer = require('multer');
const multerS3 = require('multer-s3');
const crypto = require('crypto');
const path = require('path');
const { s3Client, S3_BUCKET_NAME, isMock } = require('../config/s3');
const ApiError = require('../utils/ApiError');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Validates uploaded file MIME types strictly allowing only JPEG, PNG, and WebP.
 *
 * @param {object} req - Express request
 * @param {object} file - Uploaded file metadata
 * @param {Function} cb - Multer callback
 */
const fileFilter = (req, file, cb) => {
  if (file && ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        'Invalid file type. Only JPEG, PNG and WebP are allowed'
      ),
      false
    );
  }
};

let storage;

if (!isMock) {
  try {
    storage = multerS3({
      s3: s3Client,
      bucket: S3_BUCKET_NAME,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.webp';
        const key = `products/${crypto.randomUUID()}${ext}`;
        cb(null, key);
      },
    });
  } catch {
    storage = multer.memoryStorage();
  }
} else {
  // Memory storage for local test/dev environments without active AWS credentials
  storage = multer.memoryStorage();
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5,
  },
});

module.exports = {
  upload,
  fileFilter,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
};
