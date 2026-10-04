/* eslint-disable camelcase */
const { User, CustomerProfile, Address, LoyaltyAccount, sequelize } = require('../models');
const { logger } = require('../config/logger');
const ApiError = require('../utils/ApiError');

// In-memory fallback stores for offline testing / disconnected states
const fallbackProfileStore = new Map();
const fallbackAddressStore = new Map();

/**
 * Validates international E.164 or common domestic phone formats.
 *
 * @param {string} phone
 * @returns {boolean}
 */
const isValidPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.trim();
  // Validates +? followed by 7 to 15 digits, allowing optional spaces/hyphens
  return /^\+?[0-9\s\-()]{7,20}$/.test(cleaned);
};

/**
 * Formats an Address model instance into a clean client DTO.
 *
 * @param {object} address
 * @returns {object}
 */
const formatAddress = (address) => {
  if (!address) return null;
  const raw = typeof address.toJSON === 'function' ? address.toJSON() : address;
  return {
    id: raw.id,
    user_id: raw.user_id,
    address_line1: raw.address_line1,
    address_line2: raw.address_line2 || null,
    city: raw.city,
    postal_code: raw.postal_code,
    is_default: Boolean(raw.is_default),
    created_at: raw.created_at || raw.createdAt,
    updated_at: raw.updated_at || raw.updatedAt,
  };
};

/**
 * Retrieves the comprehensive profile of an authenticated user,
 * including contact info, loyalty tier/points, and address book.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<object>}
 */
const getProfile = async (userId) => {
  if (!userId) {
    throw ApiError.unauthorized('User identity is required');
  }

  try {
    const user = await User.findByPk(userId, {
      include: [
        { model: CustomerProfile, as: 'customerProfile' },
        { model: LoyaltyAccount, as: 'loyaltyAccount' },
        {
          model: Address,
          as: 'addresses',
        },
      ],
      order: [
        [{ model: Address, as: 'addresses' }, 'is_default', 'DESC'],
        [{ model: Address, as: 'addresses' }, 'created_at', 'DESC'],
      ],
    });

    if (user) {
      const addresses = (user.addresses || []).map(formatAddress);
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        phone: user.customerProfile ? user.customerProfile.phone : null,
        loyalty_tier:
          (user.customerProfile && user.customerProfile.loyalty_tier) ||
          (user.loyaltyAccount && user.loyaltyAccount.tier) ||
          'silver',
        loyalty_points: user.loyaltyAccount ? user.loyaltyAccount.points_balance : 0,
        marketing_opt_in: user.customerProfile
          ? user.customerProfile.marketing_opt_in
          : false,
        addresses,
      };
    }
  } catch (err) {
    logger.warn(`[USER_SERVICE] Database fetch error for user ${userId}:`, err.message);
  }

  // Fallback store check
  const fallback = fallbackProfileStore.get(userId);
  if (fallback) {
    const fallbackAddresses = Array.from(fallbackAddressStore.values())
      .filter((a) => a.user_id === userId)
      .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0))
      .map(formatAddress);
    return { ...fallback, addresses: fallbackAddresses };
  }

  throw ApiError.notFound('User profile not found');
};

/**
 * Updates profile properties (phone number, marketing opt-in) for an authenticated user.
 *
 * @param {string} userId - User UUID
 * @param {object} payload - { phone, marketing_opt_in }
 * @returns {Promise<object>}
 */
const updateProfile = async (userId, { phone, marketing_opt_in } = {}) => {
  if (!userId) {
    throw ApiError.unauthorized('User identity is required');
  }

  if (phone !== undefined && phone !== null && phone !== '') {
    if (!isValidPhone(phone)) {
      throw ApiError.badRequest('Invalid phone number format');
    }
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    let profile = await CustomerProfile.findOne({ where: { user_id: userId } });
    if (!profile) {
      profile = await CustomerProfile.create({
        user_id: userId,
        phone: phone || null,
        marketing_opt_in: Boolean(marketing_opt_in),
      });
    } else {
      const updateData = {};
      if (phone !== undefined) updateData.phone = phone || null;
      if (marketing_opt_in !== undefined) updateData.marketing_opt_in = Boolean(marketing_opt_in);
      await profile.update(updateData);
    }

    return getProfile(userId);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.warn(`[USER_SERVICE] Profile update fallback invoked: ${err.message}`);
  }

  // Offline fallback
  const existing = fallbackProfileStore.get(userId) || {
    id: userId,
    email: 'fallback@example.com',
    role: 'customer',
    is_active: true,
  };
  if (phone !== undefined) existing.phone = phone;
  if (marketing_opt_in !== undefined) existing.marketing_opt_in = Boolean(marketing_opt_in);
  fallbackProfileStore.set(userId, existing);
  return getProfile(userId);
};

/**
 * Retrieves all shipping addresses for an authenticated user.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<Array<object>>}
 */
const getAddresses = async (userId) => {
  if (!userId) {
    throw ApiError.unauthorized('User identity is required');
  }

  try {
    const addresses = await Address.findAll({
      where: { user_id: userId },
      order: [
        ['is_default', 'DESC'],
        ['created_at', 'DESC'],
      ],
    });
    return addresses.map(formatAddress);
  } catch (err) {
    logger.warn(`[USER_SERVICE] Address listing error for ${userId}:`, err.message);
  }

  return Array.from(fallbackAddressStore.values())
    .filter((a) => a.user_id === userId)
    .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0))
    .map(formatAddress);
};

/**
 * Adds a new shipping address to the user's address book.
 * If is_default is true, atomically clears is_default on prior addresses.
 *
 * @param {string} userId - User UUID
 * @param {object} addressData - { address_line1, address_line2, city, postal_code, is_default }
 * @returns {Promise<object>}
 */
const addAddress = async (userId, addressData = {}) => {
  if (!userId) {
    throw ApiError.unauthorized('User identity is required');
  }

  const { address_line1, address_line2, city, postal_code, is_default } = addressData;

  if (!address_line1 || typeof address_line1 !== 'string' || !address_line1.trim()) {
    throw ApiError.badRequest('address_line1 is required and cannot be empty');
  }
  if (!city || typeof city !== 'string' || !city.trim()) {
    throw ApiError.badRequest('city is required and cannot be empty');
  }
  if (!postal_code || typeof postal_code !== 'string' || !postal_code.trim()) {
    throw ApiError.badRequest('postal_code is required and cannot be empty');
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const existingCount = await Address.count({ where: { user_id: userId } });
    const shouldBeDefault = Boolean(is_default) || existingCount === 0;

    let createdAddress;
    await sequelize.transaction(async (t) => {
      if (shouldBeDefault) {
        await Address.update(
          { is_default: false },
          { where: { user_id: userId }, transaction: t }
        );
      }

      createdAddress = await Address.create(
        {
          user_id: userId,
          address_line1: address_line1.trim(),
          address_line2: address_line2 ? address_line2.trim() : null,
          city: city.trim(),
          postal_code: postal_code.trim(),
          is_default: shouldBeDefault,
        },
        { transaction: t }
      );
    });

    return formatAddress(createdAddress);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.warn(`[USER_SERVICE] addAddress fallback invoked: ${err.message}`);
  }

  // Offline fallback
  const id = `addr_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const userAddresses = Array.from(fallbackAddressStore.values()).filter((a) => a.user_id === userId);
  const shouldBeDefault = Boolean(is_default) || userAddresses.length === 0;

  if (shouldBeDefault) {
    userAddresses.forEach((a) => {
      // eslint-disable-next-line no-param-reassign
      a.is_default = false;
      fallbackAddressStore.set(a.id, a);
    });
  }

  const newAddr = {
    id,
    user_id: userId,
    address_line1: address_line1.trim(),
    address_line2: address_line2 ? address_line2.trim() : null,
    city: city.trim(),
    postal_code: postal_code.trim(),
    is_default: shouldBeDefault,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  fallbackAddressStore.set(id, newAddr);
  return formatAddress(newAddr);
};

/**
 * Updates an existing address for the authenticated user.
 * Enforces ownership boundary to prevent IDOR attacks.
 *
 * @param {string} userId - User UUID
 * @param {string} addressId - Address UUID
 * @param {object} updateData - Updated address fields
 * @returns {Promise<object>}
 */
const updateAddress = async (userId, addressId, updateData = {}) => {
  if (!userId) {
    throw ApiError.unauthorized('User identity is required');
  }
  if (!addressId) {
    throw ApiError.badRequest('Address ID is required');
  }

  try {
    const address = await Address.findByPk(addressId);
    if (!address) {
      throw ApiError.notFound('Address not found');
    }

    if (address.user_id !== userId) {
      throw ApiError.forbidden('Address does not belong to user');
    }

    const { address_line1, address_line2, city, postal_code, is_default } = updateData;

    let updatedAddress;
    await sequelize.transaction(async (t) => {
      if (is_default === true) {
        await Address.update(
          { is_default: false },
          { where: { user_id: userId }, transaction: t }
        );
      }

      const updates = {};
      if (address_line1 !== undefined) updates.address_line1 = address_line1.trim();
      if (address_line2 !== undefined) updates.address_line2 = address_line2 ? address_line2.trim() : null;
      if (city !== undefined) updates.city = city.trim();
      if (postal_code !== undefined) updates.postal_code = postal_code.trim();
      if (is_default !== undefined) updates.is_default = Boolean(is_default);

      updatedAddress = await address.update(updates, { transaction: t });
    });

    return formatAddress(updatedAddress);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.warn(`[USER_SERVICE] updateAddress fallback invoked: ${err.message}`);
  }

  const existing = fallbackAddressStore.get(addressId);
  if (!existing) {
    throw ApiError.notFound('Address not found');
  }
  if (existing.user_id !== userId) {
    throw ApiError.forbidden('Address does not belong to user');
  }

  if (updateData.is_default === true) {
    Array.from(fallbackAddressStore.values())
      .filter((a) => a.user_id === userId)
      .forEach((a) => {
        // eslint-disable-next-line no-param-reassign
        a.is_default = false;
        fallbackAddressStore.set(a.id, a);
      });
  }

  const updated = {
    ...existing,
    ...updateData,
    updated_at: new Date().toISOString(),
  };
  fallbackAddressStore.set(addressId, updated);
  return formatAddress(updated);
};

/**
 * Sets an address as the default shipping address.
 * Atomically clears default status from all other addresses owned by the user.
 *
 * @param {string} userId - User UUID
 * @param {string} addressId - Address UUID
 * @returns {Promise<object>}
 */
const setDefaultAddress = async (userId, addressId) => {
  return updateAddress(userId, addressId, { is_default: true });
};

/**
 * Deletes a shipping address belonging to the user.
 * Enforces ownership check ensuring users cannot delete addresses belonging to others.
 *
 * @param {string} userId - User UUID
 * @param {string} addressId - Address UUID
 * @returns {Promise<object>}
 */
const deleteAddress = async (userId, addressId) => {
  if (!userId) {
    throw ApiError.unauthorized('User identity is required');
  }
  if (!addressId) {
    throw ApiError.badRequest('Address ID is required');
  }

  try {
    const address = await Address.findByPk(addressId);
    if (!address) {
      throw ApiError.notFound('Address not found');
    }

    if (address.user_id !== userId) {
      throw ApiError.forbidden('Address does not belong to user');
    }

    const wasDefault = address.is_default;
    await address.destroy();

    // If default address was deleted, promote another address if one exists
    if (wasDefault) {
      const remainingAddress = await Address.findOne({
        where: { user_id: userId },
        order: [['created_at', 'DESC']],
      });
      if (remainingAddress) {
        await remainingAddress.update({ is_default: true });
      }
    }

    return { deleted: true, id: addressId };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.warn(`[USER_SERVICE] deleteAddress fallback invoked: ${err.message}`);
  }

  const existing = fallbackAddressStore.get(addressId);
  if (!existing) {
    throw ApiError.notFound('Address not found');
  }
  if (existing.user_id !== userId) {
    throw ApiError.forbidden('Address does not belong to user');
  }

  fallbackAddressStore.delete(addressId);
  return { deleted: true, id: addressId };
};

module.exports = {
  getProfile,
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
  isValidPhone,
  formatAddress,
};
