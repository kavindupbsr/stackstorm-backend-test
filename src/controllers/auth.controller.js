const authService = require('../services/auth.service');
const { successResponse } = require('../utils/responseFormatter');

/**
 * Handles customer registration HTTP request.
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

/**
 * Handles user login HTTP request.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });

    return successResponse(res, result, 'Login successful', 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Handles refresh token rotation HTTP request.
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    const result = await authService.refreshToken(token);

    return successResponse(res, result, 'Token refreshed successfully', 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Handles user logout HTTP request.
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    await authService.logout(token);

    return successResponse(res, null, 'Logged out successfully', 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
};
