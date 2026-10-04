const { Sequelize } = require('sequelize');
const dbConfigs = require('../config/database');
const { logger } = require('../config/logger');

const User = require('./User');
const CustomerProfile = require('./CustomerProfile');
const Address = require('./Address');
const Category = require('./Category');
const Product = require('./Product');
const ProductVariant = require('./ProductVariant');
const ProductImage = require('./ProductImage');
const Review = require('./Review');
const Wishlist = require('./Wishlist');
const CartItem = require('./CartItem');

const env = process.env.NODE_ENV || 'development';
const config = dbConfigs[env] || dbConfigs.development;

const sequelize = new Sequelize(config.database, config.username, config.password, config);

// Initialize all models
const models = {
  User: User.initModel(sequelize),
  CustomerProfile: CustomerProfile.initModel(sequelize),
  Address: Address.initModel(sequelize),
  Category: Category.initModel(sequelize),
  Product: Product.initModel(sequelize),
  ProductVariant: ProductVariant.initModel(sequelize),
  ProductImage: ProductImage.initModel(sequelize),
  Review: Review.initModel(sequelize),
  Wishlist: Wishlist.initModel(sequelize),
  CartItem: CartItem.initModel(sequelize),
};

// Execute model associations
Object.values(models).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(models);
  }
});

/**
 * Connect to PostgreSQL with exponential backoff retry strategy.
 *
 * @param {number} [maxRetries=5] - Maximum retry attempts
 * @param {number} [initialDelay=1000] - Initial delay in ms
 * @returns {Promise<boolean>}
 */
const connectWithRetry = async (maxRetries = 5, initialDelay = 1000) => {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sequelize.authenticate();
      logger.info('[DATABASE] PostgreSQL 17 connection pool established successfully');
      return true;
    } catch (error) {
      attempt += 1;
      const delay = initialDelay * 2 ** (attempt - 1);
      logger.warn(
        `[DATABASE] Connection attempt ${attempt}/${maxRetries} failed: ${error.message}. Retrying in ${delay}ms...`
      );

      if (attempt >= maxRetries) {
        logger.error(
          '[DATABASE] Maximum connection retries exceeded. Database connection failed.',
          {
            error: error.message,
            stack: error.stack,
          }
        );
        throw error;
      }

      // eslint-disable-next-line no-await-in-loop, no-promise-executor-return
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return false;
};

const db = {
  sequelize,
  Sequelize,
  connectWithRetry,
  ...models,
};

module.exports = db;
