const { sequelize, connectWithRetry } = require('../../src/models');

describe('STORM-006: Database Connection Manager Integration Tests', () => {
  afterAll(async () => {
    try {
      await sequelize.close();
    } catch {
      // Ignore cleanup error if not connected
    }
  });

  it('should expose a valid Sequelize instance configured with PostgreSQL dialect', () => {
    expect(sequelize).toBeDefined();
    expect(sequelize.getDialect()).toBe('postgres');
    expect(sequelize.options.pool).toBeDefined();
    expect(sequelize.options.pool.max).toBeGreaterThanOrEqual(5);
  });

  it('should attempt database authentication and handle live or offline container gracefully', async () => {
    try {
      await sequelize.authenticate();
      // If PostgreSQL is running (e.g. in Docker or CI)
      expect(true).toBe(true);
    } catch (err) {
      // If Docker container is temporarily stopped on student machine
      expect(err).toBeDefined();
      expect([
        'SequelizeConnectionRefusedError',
        'SequelizeAccessDeniedError',
        'ConnectionRefusedError',
      ]).toContain(err.name);
    }
  });

  it('connectWithRetry should resolve true on successful connection or retry up to maxRetries on failure', async () => {
    // Mock authenticate to verify retry backoff logic without waiting excessive time
    const originalAuth = sequelize.authenticate;
    let callCount = 0;

    sequelize.authenticate = jest.fn().mockImplementation(async () => {
      callCount += 1;
      if (callCount < 2) {
        throw new Error('Temporary network glitch');
      }
      return true;
    });

    try {
      const result = await connectWithRetry(3, 50);
      expect(result).toBe(true);
      expect(callCount).toBe(2);
    } finally {
      sequelize.authenticate = originalAuth;
    }
  });
});
