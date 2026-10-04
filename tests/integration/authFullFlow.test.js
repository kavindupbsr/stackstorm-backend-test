const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const { User, CustomerProfile, LoyaltyAccount, sequelize } = require('../../src/models');
const redisClient = require('../../src/config/redis');

describe('Auth Full Lifecycle Integration', () => {
  const testPassword = 'Password123!';
  const mockUserId = 'f1111111-2222-3333-4444-555555555555';
  const testEmail = 'flow_customer@dickwellafashion.lk';

  const mockUserInstance = {
    id: mockUserId,
    email: testEmail,
    role: 'customer',
    is_active: true,
    failed_login_attempts: 0,
    password_hash: bcrypt.hashSync(testPassword, 4),
    toJSON() {
      return {
        id: this.id,
        email: this.email,
        role: this.role,
        is_active: this.is_active,
      };
    },
    save: jest.fn().mockResolvedValue(true),
  };

  let currentAccessToken = '';
  let currentRefreshToken = '';

  beforeAll(() => {
    // Ensure test environment does not enforce production rate limits
    process.env.TEST_RATE_LIMIT = 'false';
  });

  afterAll(async () => {
    try {
      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore cleanup error if already closed
    }
  });

  it('Register customer', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null);
    jest.spyOn(User, 'create').mockResolvedValue(mockUserInstance);
    jest.spyOn(CustomerProfile, 'create').mockResolvedValue({ id: 'prof-01', user_id: mockUserId });
    jest
      .spyOn(LoyaltyAccount, 'create')
      .mockResolvedValue({ customer_id: mockUserId, points_balance: 0 });
    jest.spyOn(sequelize, 'transaction').mockImplementation(async (cb) => cb({}));

    const response = await request(app).post('/api/v1/auth/register').send({
      email: testEmail,
      password: testPassword,
      fullName: 'Dickwella Full Flow Shopper',
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(testEmail);
    expect(response.body.data.user.password_hash).toBeUndefined();
  });

  it('Login with credentials', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(mockUserInstance);

    const response = await request(app).post('/api/v1/auth/login').send({
      email: testEmail,
      password: testPassword,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBeDefined();
    expect(response.body.data.refreshToken).toBeDefined();

    currentAccessToken = response.body.data.accessToken;
    currentRefreshToken = response.body.data.refreshToken;
  });

  it('Access protected route', async () => {
    jest.spyOn(User, 'findByPk').mockResolvedValue(mockUserInstance);

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${currentAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe(testEmail);
    expect(response.body.data.role).toBe('customer');
  });

  it('Refresh token rotation', async () => {
    jest.spyOn(User, 'findByPk').mockResolvedValue(mockUserInstance);

    const response = await request(app).post('/api/v1/auth/refresh-token').send({
      refreshToken: currentRefreshToken,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBeDefined();
    expect(response.body.data.refreshToken).toBeDefined();

    // Verify token rotation: new refresh token must differ from old one
    expect(response.body.data.refreshToken).not.toBe(currentRefreshToken);

    currentAccessToken = response.body.data.accessToken;
    currentRefreshToken = response.body.data.refreshToken;
  });

  it('Logout revokes token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${currentAccessToken}`)
      .send({
        refreshToken: currentRefreshToken,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Attempting to refresh with the revoked token must fail with 401
    const rejectedRefresh = await request(app).post('/api/v1/auth/refresh-token').send({
      refreshToken: currentRefreshToken,
    });

    expect(rejectedRefresh.status).toBe(401);
    expect(rejectedRefresh.body.success).toBe(false);
  });
});
