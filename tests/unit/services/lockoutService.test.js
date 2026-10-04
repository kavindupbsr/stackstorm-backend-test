const lockoutService = require('../../../src/services/lockout.service');
const redisClient = require('../../../src/config/redis');

describe('STORM-014: LockoutService Unit Test Suite', () => {
  const testEmail = 'lockout_unit@test.lk';

  beforeEach(async () => {
    await lockoutService.resetFailedAttempts(testEmail);
  });

  afterAll(async () => {
    await lockoutService.resetFailedAttempts(testEmail);
  });

  describe('isLocked', () => {
    it('should report isLocked=false for accounts with no active lock', async () => {
      const status = await lockoutService.isLocked(testEmail);
      expect(status.isLocked).toBe(false);
      expect(status.remainingSeconds).toBe(0);
    });

    it('should report isLocked=true and return positive remaining lock time when lockout key exists', async () => {
      // Manually set lockout key
      await redisClient.setex(`lockout:${testEmail}`, 900, '1');

      const status = await lockoutService.isLocked(testEmail);
      expect(status.isLocked).toBe(true);
      expect(status.remainingSeconds).toBeGreaterThan(0);
      expect(status.remainingMinutes).toBeGreaterThanOrEqual(1);
    });
  });

  describe('recordFailedAttempt & 5-Attempt Escalation', () => {
    it('should increment attempt counter on attempts 1 through 4 without locking', async () => {
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        // eslint-disable-next-line no-await-in-loop
        const result = await lockoutService.recordFailedAttempt(testEmail);
        expect(result.isLocked).toBe(false);
        expect(result.attempts).toBe(attempt);
        expect(result.remainingAttempts).toBe(5 - attempt);
      }
    });

    it('should trigger account lockout on the 5th consecutive failure and set 15-minute TTL', async () => {
      // Record 4 attempts
      for (let i = 1; i <= 4; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await lockoutService.recordFailedAttempt(testEmail);
      }

      // 5th attempt triggers lockout
      const fifthAttempt = await lockoutService.recordFailedAttempt(testEmail);
      expect(fifthAttempt.isLocked).toBe(true);
      expect(fifthAttempt.remainingSeconds).toBe(900);
      expect(fifthAttempt.remainingMinutes).toBe(15);

      // Verify isLocked is now true
      const lockStatus = await lockoutService.isLocked(testEmail);
      expect(lockStatus.isLocked).toBe(true);
    });
  });

  describe('resetFailedAttempts', () => {
    it('should clear failed attempt counters and active lockout keys', async () => {
      await redisClient.setex(`failed_login:${testEmail}`, 900, '3');
      await redisClient.setex(`lockout:${testEmail}`, 900, '1');

      await lockoutService.resetFailedAttempts(testEmail);

      const status = await lockoutService.isLocked(testEmail);
      expect(status.isLocked).toBe(false);
      const counter = await redisClient.get(`failed_login:${testEmail}`);
      expect(counter).toBeNull();
    });
  });
});
