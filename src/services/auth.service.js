const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sequelize, User, CustomerProfile, LoyaltyAccount } = require('../models');
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
 * @returns {Promise<object>} Created user (without password_hash), JWT token, and loyalty summary
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

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET || 'stackstorm-jwt-secret-key-default-2026',
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const userPayload = user.toJSON ? user.toJSON() : { ...user };
  delete userPayload.password_hash;
  if (fullName) {
    userPayload.fullName = fullName;
  }

  return {
    user: userPayload,
    token,
    loyalty: {
      tier: loyaltyAccount.tier,
      points: loyaltyAccount.points_balance,
    },
  };
};

module.exports = {
  getBcryptWorkFactor,
  register,
};
