const express = require('express');
const authController = require('../controllers/auth.controller');
const { validate, registerValidationRules } = require('../validators/auth.validator');

const router = express.Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new customer account and initialize customer profile & loyalty
 * @access  Public
 */
router.post('/register', validate(registerValidationRules), authController.register);

module.exports = router;
