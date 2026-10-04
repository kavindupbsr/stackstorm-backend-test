const bcrypt = require('bcryptjs');
const { sequelize, User, CustomerProfile, LoyaltyAccount } = require('../models');
const tokenService = require('./token.service');
const ApiError = require('../utils/ApiError');

/**
 * Returns the configured bcrypt work factor.
 * Defaults to 4 in test environment for ultra-fast CI runs, and 12 in production/development.
 *
 * @returns {number}
 */
const getBcryptWorkFactor = () => {
  if (process.env.BCRYPT_WORK_FACTOR) {
    return parseInt(process.env.BCRYPT_WORK_FACTOR, 10);
  }
  return process.env.NODE_ENV === 'test' ? 4 : 12;
};

/**
 * Registers a new customer with salt-hashed password, customer profile, and initial Silver loyalty account.
 * All write operations are executed inside an atomic Sequelize managed transaction.
 *
 * @param {object} params
 * @param {string} params.email - Customer email address
 * @param {string} params.password - Plaintext password meeting security policy
 * @param {string} params.fullName - Customer full name
 * @param {string} [params.phone] - Optional contact phone number
 * @param {boolean} [params.marketingOptIn=false] - Optional marketing opt-in flag
 * @returns {Promise<object>} Created user (without password_hash), token pair, and loyalty summary
 */
const register = async ({ email, password, fullName, phone, marketingOptIn = false }) => {
  const normalizedEmail = email ? email.trim().toLowerCase() : '';

  // Proactive unique email check
  const existingUser = await User.findOne({ where: { email: normalizedEmail } });
  if (existingUser) {
    throw ApiError.conflict('Email is already registered');
  }

  const workFactor = getBcryptWorkFactor();
  const passwordHash = await bcrypt.hash(password, workFactor);

  const { user, loyaltyAccount } = await sequelize.transaction(async (transaction) => {
    const newUser = await User.create(
      {
        email: normalizedEmail,
        password_hash: passwordHash,
        role: 'customer',
        is_active: true,
      },
      { transaction }
    );

    await CustomerProfile.create(
      {
        user_id: newUser.id,
        phone: phone || null,
        loyalty_tier: 'silver',
        marketing_opt_in: Boolean(marketingOptIn),
      },
      { transaction }
    );

    const newLoyaltyAccount = await LoyaltyAccount.create(
      {
        customer_id: newUser.id,
        tier: 'silver',
        points_balance: 0,
        lifetime_points: 0,
      },
      { transaction }
    );

    return { user: newUser, loyaltyAccount: newLoyaltyAccount };
  });

  const tokens = await tokenService.generateTokenPair(user);

  const userPayload = user.toJSON ? user.toJSON() : { ...user };
  delete userPayload.password_hash;
  if (fullName) {
    userPayload.fullName = fullName;
  }

  return {
    user: userPayload,
    token: tokens.accessToken,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    loyalty: {
      tier: loyaltyAccount.tier,
      points: loyaltyAccount.points_balance,
    },
  };
};

/**
 * Authenticates user credentials and returns dual token pair (access + refresh).
 *
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<object>}
 */
const login = async ({ email, password }) => {
  const normalizedEmail = email ? email.trim().toLowerCase() : '';

  // Query with password_hash explicitly loaded
  const user = await User.scope('withPassword').findOne({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!user.is_active) {
    throw ApiError.forbidden('Account is deactivated');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const tokens = await tokenService.generateTokenPair(user);

  const safeUser = user.toJSON ? user.toJSON() : { ...user };
  delete safeUser.password_hash;

  return {
    user: safeUser,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
};

/**
 * Rotates an existing refresh token and returns a new token pair.
 *
 * @param {string} refreshToken
 * @returns {Promise<object>}
 */
const refreshToken = async (token) => {
  return tokenService.rotateRefreshToken(token);
};

/**
 * Invalidates a refresh token session (logout).
 *
 * @param {string} token
 * @returns {Promise<boolean>}
 */
const logout = async (token) => {
  if (!token) return true;
  return tokenService.revokeRefreshToken(token);
};

module.exports = {
  getBcryptWorkFactor,
  register,
  login,
  refreshToken,
  logout,
};
