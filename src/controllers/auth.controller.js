const authService = require('../services/auth.service');
const { successResponse } = require('../utils/responseFormatter');

/**
 * Handles customer registration HTTP request.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const register = async (req, res, next) => {
  try {
    const { email, password, fullName, phone, marketingOptIn } = req.body;
    const result = await authService.register({
      email,
      password,
      fullName,
      phone,
      marketingOptIn,
    });

    return successResponse(res, result, 'User registered successfully', 201);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
};
