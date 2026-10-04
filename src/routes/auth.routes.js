const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const { successResponse } = require('../utils/responseFormatter');
const {
  validate,
  registerValidationRules,
  loginValidationRules,
  refreshTokenValidationRules,
} = require('../validators/auth.validator');

const router = express.Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new customer account
 * @access  Public
 */
router.post('/register', validate(registerValidationRules), authController.register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate credentials and issue access + refresh token pair
 * @access  Public
 */
router.post('/login', validate(loginValidationRules), authController.login);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Rotate refresh token and issue new token pair
 * @access  Public
 */
router.post('/refresh-token', validate(refreshTokenValidationRules), authController.refreshToken);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Revoke active refresh token session
 * @access  Public
 */
router.post('/logout', authController.logout);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Retrieve authenticated user profile from token claims
 * @access  Protected
 */
router.get('/me', authenticate, (req, res) => {
  return successResponse(res, req.user, 'Current user retrieved');
});

module.exports = router;
