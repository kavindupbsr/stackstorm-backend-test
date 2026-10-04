const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const { User, sequelize } = require('../../src/models');

describe('STORM-013: Auth Login & Refresh Token Rotation Integration Test Suite', () => {
  const testPassword = 'Password@123';
  const testUser = {
    id: 'd1111111-2222-3333-4444-555555555555',
    email: 'integration_user@dickwellafashion.lk',
    password_hash: bcrypt.hashSync(testPassword, 4),
    role: 'customer',
    is_active: true,
    toJSON: () => ({
      id: 'd1111111-2222-3333-4444-555555555555',
      email: 'integration_user@dickwellafashion.lk',
      role: 'customer',
      is_active: true,
    }),
  };

  afterAll(async () => {
    try {
      await sequelize.close();
    } catch {
      // Ignore cleanup error if not connected
    }
  });

  describe('POST /api/v1/auth/login', () => {
    it('should authenticate valid credentials and return accessToken and refreshToken', async () => {
      const findOneSpy = jest.spyOn(User, 'findOne').mockResolvedValue(testUser);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'integration_user@dickwellafashion.lk',
        password: testPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.user.email).toBe(testUser.email);

      findOneSpy.mockRestore();
    });

    it('should reject login with wrong password (401 Unauthorized)', async () => {
      const findOneSpy = jest.spyOn(User, 'findOne').mockResolvedValue(testUser);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'integration_user@dickwellafashion.lk',
        password: 'WrongPassword@999',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');

      findOneSpy.mockRestore();
    });

    it('should reject login for non-existent user (401 Unauthorized)', async () => {
      const findOneSpy = jest.spyOn(User, 'findOne').mockResolvedValue(null);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'nonexistent@dickwellafashion.lk',
        password: testPassword,
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');

      findOneSpy.mockRestore();
    });
  });

  describe('POST /api/v1/auth/refresh-token & Token Rotation Flow', () => {
    it('should execute full rotation cycle: issue new tokens and invalidate old refresh token', async () => {
      const findOneSpy = jest.spyOn(User, 'findOne').mockResolvedValue(testUser);
      const findByPkSpy = jest.spyOn(User, 'findByPk').mockResolvedValue(testUser);

      // 1. Login to obtain initial tokens
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'integration_user@dickwellafashion.lk',
        password: testPassword,
      });

      expect(loginRes.status).toBe(200);
      const initialRefreshToken = loginRes.body.data.refreshToken;
      const initialAccessToken = loginRes.body.data.accessToken;

      // 2. Perform refresh token rotation
      const refreshRes = await request(app).post('/api/v1/auth/refresh-token').send({
        refreshToken: initialRefreshToken,
      });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.accessToken).toBeDefined();
      expect(refreshRes.body.data.refreshToken).toBeDefined();
      expect(refreshRes.body.data.refreshToken).not.toBe(initialRefreshToken);

      const newRefreshToken = refreshRes.body.data.refreshToken;

      // 3. ATTEMPT REUSE OF OLD REFRESH TOKEN (Must be rejected with 401)
      const reuseRes = await request(app).post('/api/v1/auth/refresh-token').send({
        refreshToken: initialRefreshToken,
      });

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.success).toBe(false);
      expect(reuseRes.body.message).toBe('Invalid or already rotated refresh token');

      // 4. Logout using new refresh token
      const logoutRes = await request(app).post('/api/v1/auth/logout').send({
        refreshToken: newRefreshToken,
      });

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // 5. Subsequent refresh after logout must fail
      const postLogoutRefresh = await request(app).post('/api/v1/auth/refresh-token').send({
        refreshToken: newRefreshToken,
      });

      expect(postLogoutRefresh.status).toBe(401);

      // 6. Test protected /me endpoint with initial access token
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${initialAccessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.id).toBe(testUser.id);
      expect(meRes.body.data.email).toBe(testUser.email);

      findOneSpy.mockRestore();
      findByPkSpy.mockRestore();
    });

    it('protected route should return 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Authentication token is required');
    });
  });
});
