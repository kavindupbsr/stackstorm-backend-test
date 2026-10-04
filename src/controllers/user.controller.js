const userService = require('../services/user.service');
const { successResponse } = require('../utils/responseFormatter');
const ApiError = require('../utils/ApiError');

/**
 * Controller handling authenticated user profile and address book endpoints.
 */

/**
 * Retrieves authenticated user profile, phone, loyalty tier, and address book.
 * Route: GET /api/v1/users/me
 */
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      throw ApiError.unauthorized('Authentication token is required');
    }

    const profile = await userService.getProfile(userId);
    return successResponse(res, profile, 'User profile retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Updates authenticated user profile details (phone, marketing opt-in).
 * Route: PUT /api/v1/users/me, PATCH /api/v1/users/me
 */
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      throw ApiError.unauthorized('Authentication token is required');
    }

    const updated = await userService.updateProfile(userId, req.body);
    return successResponse(res, updated, 'User profile updated successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Retrieves all saved shipping addresses for the authenticated user.
 * Route: GET /api/v1/users/addresses
 */
const getAddresses = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      throw ApiError.unauthorized('Authentication token is required');
    }

    const addresses = await userService.getAddresses(userId);
    return successResponse(res, addresses, 'Addresses retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Adds a new shipping address to the authenticated user's address book.
 * Route: POST /api/v1/users/addresses
 */
const addAddress = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      throw ApiError.unauthorized('Authentication token is required');
    }

    const address = await userService.addAddress(userId, req.body);
    return successResponse(res, address, 'Address added successfully', 201);
  } catch (error) {
    return next(error);
  }
};

/**
 * Updates an existing shipping address for the authenticated user.
 * Route: PUT /api/v1/users/addresses/:id
 */
const updateAddress = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      throw ApiError.unauthorized('Authentication token is required');
    }

    const addressId = req.params.id;
    const address = await userService.updateAddress(userId, addressId, req.body);
    return successResponse(res, address, 'Address updated successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Sets an address as the default shipping address.
 * Route: PATCH /api/v1/users/addresses/:id/default
 */
const setDefaultAddress = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      throw ApiError.unauthorized('Authentication token is required');
    }

    const addressId = req.params.id;
    const address = await userService.setDefaultAddress(userId, addressId);
    return successResponse(res, address, 'Default address set successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Deletes a shipping address belonging to the authenticated user.
 * Route: DELETE /api/v1/users/addresses/:id
 */
const deleteAddress = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      throw ApiError.unauthorized('Authentication token is required');
    }

    const addressId = req.params.id;
    const result = await userService.deleteAddress(userId, addressId);
    return successResponse(res, result, 'Address deleted successfully');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
};
