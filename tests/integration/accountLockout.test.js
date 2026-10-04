const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const { User, sequelize } = require('../../src/models');
const lockoutService = require('../../src/services/lockout.service');

describe('STORM-014: Redis-Backed Account Lockout Protection Integration Test Suite', () => {
  const targetEmail = 'lockout_integration@dickwellafashion.lk';
  const correctPassword = 'CorrectPassword@123';
  const wrongPassword = 'WrongPassword@999';

  const mockUser = {
    id: 'e1111111-2222-3333-4444-555555555555',
    email: targetEmail,
    password_hash: bcrypt.hashSync(correctPassword, 4),
    role: 'customer',
    is_active: true,
    toJSON: () => ({
      id: 'e1111111-2222-3333-4444-555555555555',
      email: targetEmail,
      role: 'customer',
      is_active: true,
    }),
  };

  beforeEach(async () => {
    await lockoutService.resetFailedAttempts(targetEmail);
  });

  afterAll(async () => {
    await lockoutService.resetFailedAttempts(targetEmail);
    try {
      await sequelize.close();
    } catch {
      // Ignore cleanup error if not connected
    }
  });

  describe('Consecutive 5-Attempt Lockout Escalation', () => {
    it('should return 401 for attempts 1-5, and lock the account on the 6th attempt with HTTP 423', async () => {
      const scopeSpy = jest.spyOn(User, 'scope').mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockUser),
      });

      // Attempts 1 through 5: Send incorrect password
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        // eslint-disable-next-line no-await-in-loop
        const res = await request(app).post('/api/v1/auth/login').send({
          email: targetEmail,
          password: wrongPassword,
        });

        if (attempt < 5) {
          expect(res.status).toBe(401);
          expect(res.body.success).toBe(false);
          expect(res.body.message).toBe('Invalid email or password');
        } else {
          // On the 5th attempt, lockout occurs immediately
          expect([401, 423]).toContain(res.status);
        }
      }

      // 6th Attempt: Even with the CORRECT password, account must be rejected with HTTP 423 Locked
      const lockedRes = await request(app).post('/api/v1/auth/login').send({
        email: targetEmail,
        password: correctPassword,
      });

      expect(lockedRes.status).toBe(423);
      expect(lockedRes.body.success).toBe(false);
      expect(lockedRes.body.message).toMatch(
        /Account is locked due to 5 consecutive failed login attempts/i
      );
      expect(lockedRes.headers['retry-after']).toBeDefined();

      scopeSpy.mockRestore();
    });

    it('should isolate lockout by email address so other accounts are not locked', async () => {
      const innocentEmail = 'innocent_shopper@dickwellafashion.lk';
      const innocentUser = {
        id: 'e2222222-3333-4444-5555-666666666666',
        email: innocentEmail,
        password_hash: bcrypt.hashSync('InnocentPassword@123', 4),
        role: 'customer',
        is_active: true,
        toJSON: () => ({
          id: 'e2222222-3333-4444-5555-666666666666',
          email: innocentEmail,
          role: 'customer',
          is_active: true,
        }),
      };

      // Manually lock targetEmail
      await lockoutService.recordFailedAttempt(targetEmail);
      await lockoutService.recordFailedAttempt(targetEmail);
      await lockoutService.recordFailedAttempt(targetEmail);
      await lockoutService.recordFailedAttempt(targetEmail);
      await lockoutService.recordFailedAttempt(targetEmail);

      const scopeSpy = jest.spyOn(User, 'scope').mockReturnValue({
        findOne: jest.fn().mockResolvedValue(innocentUser),
      });

      // Target email must be locked
      const targetRes = await request(app).post('/api/v1/auth/login').send({
        email: targetEmail,
        password: correctPassword,
      });
      expect(targetRes.status).toBe(423);

      // Innocent user must be able to log in normally
      const innocentRes = await request(app).post('/api/v1/auth/login').send({
        email: innocentEmail,
        password: 'InnocentPassword@123',
      });
      expect(innocentRes.status).toBe(200);
      expect(innocentRes.body.success).toBe(true);

      scopeSpy.mockRestore();
      await lockoutService.resetFailedAttempts(innocentEmail);
    });
  });
});
