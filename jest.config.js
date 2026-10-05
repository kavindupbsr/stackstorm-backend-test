/**
 * StackStorm Centralized Jest Configuration
 * Enforces Node.js runtime environment, shift-left coverage thresholds (>= 80%),
 * and test runner behavior.
 */

module.exports = {
  testEnvironment: 'node',
  verbose: true,
  testTimeout: 15000,
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  clearMocks: true,
  restoreMocks: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/database.js',
    '!src/models/index.js',
    '!src/migrations/**',
    '!src/seeders/**',
  ],
  coverageThreshold: {
    global: {
      branches: 65,
      functions: 75,
      lines: 80,
      statements: 80,
    },
    './src/services/auth.service.js': {
      branches: 60,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/controllers/auth.controller.js': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
};
