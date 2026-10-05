require('dotenv').config();
const { logger } = require('./logger');

const baseConfig = {
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    min: parseInt(process.env.DB_POOL_MIN || '5', 10),
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true,
  },
};

const config = {
  development: {
    ...baseConfig,
    database: process.env.DB_NAME || 'stackstorm_dev',
    logging: process.env.DB_LOGGING === 'true' ? (msg) => logger.debug(msg) : false,
  },
  test: {
    ...baseConfig,
    database: process.env.DB_NAME_TEST || 'stackstorm_test',
    logging: false,
    pool: {
      max: 5,
      min: 1,
      acquire: 10000,
      idle: 5000,
    },
  },
  production: {
    ...baseConfig,
    database: process.env.DB_NAME || 'stackstorm_dev',
    logging: (msg) => logger.info(msg),
    pool: {
      max: 30,
      min: 10,
      acquire: 60000,
      idle: 15000,
    },
    dialectOptions: {
      ssl:
        process.env.DB_SSL === 'true'
          ? {
              require: true,
              rejectUnauthorized: false,
            }
          : false,
    },
  },
};

module.exports = config;
