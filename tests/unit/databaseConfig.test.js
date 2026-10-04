const dbConfigs = require('../../src/config/database');

describe('STORM-006: Database Configuration & Connection Pool Unit Tests', () => {
  it('should define development environment config with SDS compliant connection pool', () => {
    const devConfig = dbConfigs.development;
    expect(devConfig).toBeDefined();
    expect(devConfig.dialect).toBe('postgres');
    expect(devConfig.pool).toEqual({
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000,
    });
    expect(devConfig.define).toEqual({
      timestamps: true,
      underscored: true,
      freezeTableName: true,
    });
  });

  it('should define test environment config with isolated test database and pool', () => {
    const testConfig = dbConfigs.test;
    expect(testConfig).toBeDefined();
    expect(testConfig.dialect).toBe('postgres');
    expect(testConfig.database).toContain('test');
    expect(testConfig.logging).toBe(false);
    expect(testConfig.pool.max).toBe(5);
    expect(testConfig.pool.min).toBe(1);
  });

  it('should define production environment config with higher concurrency pool limits', () => {
    const prodConfig = dbConfigs.production;
    expect(prodConfig).toBeDefined();
    expect(prodConfig.dialect).toBe('postgres');
    expect(prodConfig.pool.max).toBe(30);
    expect(prodConfig.pool.min).toBe(10);
    expect(prodConfig.pool.acquire).toBe(60000);
  });
});
