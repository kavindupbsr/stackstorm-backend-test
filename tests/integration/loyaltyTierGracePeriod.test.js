const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/services/token.service');
const loyaltyService = require('../../src/services/loyalty.service');
const {
  User,
  CustomerProfile,
  LoyaltyAccount,
  sequelize,
} = require('../../src/models');
const redisClient = require('../../src/config/redis');

describe('Integration: Loyalty Rewards & 2-Quarter Grace Period (STORM-039 / FR-022 / Issue #6)', () => {
  let customerUser;
  let adminUser;
  let customerToken;
  let adminToken;

  beforeAll(async () => {
    try {
      const ts = Date.now();

      customerUser = await User.create({
        email: `pabasara-int-${ts}@example.lk`,
        password_hash: '$2b$10$hashedpassloyaltyint00000000000001',
        first_name: 'Pabasara',
        last_name: 'Bandara',
        role: 'customer',
      });

      adminUser = await User.create({
        email: `admin-loyalty-${ts}@dickwellafashion.lk`,
        password_hash: '$2b$10$hashedpassloyaltyint00000000000002',
        first_name: 'Lakshani',
        last_name: 'Admin',
        role: 'admin',
      });

      customerToken = generateAccessToken(customerUser);
      adminToken = generateAccessToken(adminUser);

      await CustomerProfile.create({
        user_id: customerUser.id,
        loyalty_tier: 'silver',
      });

      // Initialize loyalty account with 500 points and Gold tier
      const account = await loyaltyService.getOrCreateAccount(customerUser.id);
      account.points_balance = 500;
      account.lifetime_points = 500;
      account.tier = 'gold';
      account.annual_spend = 35000.0;
      await account.save();
    } catch (err) {
      console.warn('Loyalty integration setup warning:', err.message);
    }
  });

  afterAll(async () => {
    try {
      if (customerUser) {
        await LoyaltyAccount.destroy({ where: { customer_id: customerUser.id } });
        await CustomerProfile.destroy({ where: { user_id: customerUser.id } });
        await User.destroy({ where: { id: customerUser.id } });
      }
      if (adminUser) {
        await User.destroy({ where: { id: adminUser.id } });
      }

      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore cleanup error
    }
  });

  describe('GET /api/v1/loyalty/my-account (Customer View)', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/loyalty/my-account');
      expect(res.status).toBe(401);
    });

    it('should return loyalty tier, points, and formatted annualSpend for authenticated customer', async () => {
      const res = await request(app)
        .get('/api/v1/loyalty/my-account')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customer_id).toBe(customerUser.id);
      expect(res.body.data.tier).toBe('gold');
      expect(res.body.data.points).toBe(500);
      expect(res.body.data.annualSpend).toBe('LKR 35,000.00');
    });
  });

  describe('POST /api/v1/loyalty/redeem', () => {
    it('should redeem points and return updated remaining balance', async () => {
      const res = await request(app)
        .post('/api/v1/loyalty/redeem')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ points: 150 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.points_redeemed).toBe(150);
      expect(res.body.data.remaining_points).toBe(350);
    });

    it('should reject redemption exceeding available balance with 400', async () => {
      const res = await request(app)
        .post('/api/v1/loyalty/redeem')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ points: 5000 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Insufficient points balance');
    });
  });

  describe('Admin Operations: GET /api/v1/loyalty/accounts/:id & POST /api/v1/loyalty/audit', () => {
    it('should allow admin to inspect any customer loyalty account', async () => {
      const res = await request(app)
        .get(`/api/v1/loyalty/accounts/${customerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customer_id).toBe(customerUser.id);
      expect(res.body.data.tier).toBe('gold');
    });

    it('should block non-admin customer from triggering quarterly audit with 403', async () => {
      const res = await request(app)
        .post('/api/v1/loyalty/audit')
        .set('Authorization', `Bearer ${customerToken}`)
        .send();

      expect(res.status).toBe(403);
    });

    it('should allow admin to trigger quarterly audit sweep enforcing grace periods', async () => {
      const res = await request(app)
        .post('/api/v1/loyalty/audit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_audited).toBeDefined();
    });
  });
});
