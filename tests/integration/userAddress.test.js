const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/services/token.service');
const { Address, sequelize } = require('../../src/models');
const redisClient = require('../../src/config/redis');

describe('Integration: Customer Profile & Multi-Address Book API (STORM-032)', () => {
  const userA = {
    id: 'b0000000-0000-0000-0000-000000000003', // pabasara@example.lk
    email: 'pabasara@example.lk',
    role: 'customer',
  };

  const userB = {
    id: 'b0000000-0000-0000-0000-000000000004', // thanoo@example.lk
    email: 'thanoo@example.lk',
    role: 'customer',
  };

  const tokenA = generateAccessToken(userA);
  const tokenB = generateAccessToken(userB);

  let addressA1Id;
  let addressA2Id;

  beforeAll(async () => {
    try {
      // Clean up previous test addresses for userA and userB
      await Address.destroy({ where: { user_id: [userA.id, userB.id] } });
    } catch {
      // Ignore if offline
    }
  });

  afterAll(async () => {
    try {
      await Address.destroy({ where: { user_id: [userA.id, userB.id] } });
      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore cleanup error
    }
  });

  describe('Authentication & Route Protection', () => {
    it('should reject GET /api/v1/users/me with 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/users/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/authentication token is required/i);
    });

    it('should reject POST /api/v1/users/addresses with 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/v1/users/addresses').send({
        address_line1: '12 Beach Road',
        city: 'Dickwella',
        postal_code: '81100',
      });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject DELETE /api/v1/users/addresses/:id with 401 when unauthenticated', async () => {
      const res = await request(app).delete(
        '/api/v1/users/addresses/d0000000-0000-0000-0000-000000000001'
      );
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('AC1: Customer Profile Retrieval & Updates (GET/PUT /api/v1/users/me)', () => {
    it('should return authenticated user profile, phone, loyalty tier, and address array', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(userA.id);
      expect(res.body.data.email).toBe(userA.email);
      expect(res.body.data.role).toBe('customer');
      expect(res.body.data.loyalty_tier).toBeDefined();
      expect(Array.isArray(res.body.data.addresses)).toBe(true);
    });

    it('should update user profile phone number and marketing opt-in', async () => {
      const res = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          phone: '+94771234567',
          marketing_opt_in: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.phone).toBe('+94771234567');
      expect(res.body.data.marketing_opt_in).toBe(true);
    });

    it('should reject invalid phone format with 400 Bad Request', async () => {
      const res = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          phone: 'not-a-phone-number',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid phone/i);
    });
  });

  describe('AC2: Multi-Address Book Management & Atomic Default Toggle', () => {
    it('should reject creating address when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/users/addresses')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          address_line2: 'Suite 400',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/required/i);
    });

    it('should successfully add the first address and auto-designate as default', async () => {
      const payload = {
        address_line1: '10 Beach Road',
        address_line2: 'Villa Sunset',
        city: 'Dickwella',
        postal_code: '81100',
      };

      const res = await request(app)
        .post('/api/v1/users/addresses')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.address_line1).toBe('10 Beach Road');
      expect(res.body.data.is_default).toBe(true);

      addressA1Id = res.body.data.id;
    });

    it('should add a second address with is_default=true and atomically demote the first address', async () => {
      const payload = {
        address_line1: '45 Galle Road',
        city: 'Colombo',
        postal_code: '00300',
        is_default: true,
      };

      const res = await request(app)
        .post('/api/v1/users/addresses')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.address_line1).toBe('45 Galle Road');
      expect(res.body.data.is_default).toBe(true);

      addressA2Id = res.body.data.id;

      // Verify the first address was atomically updated to is_default = false
      const listRes = await request(app)
        .get('/api/v1/users/addresses')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(2);

      const firstAddr = listRes.body.data.find((a) => a.id === addressA1Id);
      const secondAddr = listRes.body.data.find((a) => a.id === addressA2Id);

      expect(firstAddr.is_default).toBe(false);
      expect(secondAddr.is_default).toBe(true);
    });

    it('should re-promote first address to default via PATCH /addresses/:id/default', async () => {
      const res = await request(app)
        .patch(`/api/v1/users/addresses/${addressA1Id}/default`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(addressA1Id);
      expect(res.body.data.is_default).toBe(true);

      // Verify addressA2 is now not default
      const listRes = await request(app)
        .get('/api/v1/users/addresses')
        .set('Authorization', `Bearer ${tokenA}`);

      const firstAddr = listRes.body.data.find((a) => a.id === addressA1Id);
      const secondAddr = listRes.body.data.find((a) => a.id === addressA2Id);

      expect(firstAddr.is_default).toBe(true);
      expect(secondAddr.is_default).toBe(false);
    });
  });

  describe('AC3 & Security: IDOR Defense & Address Deletion', () => {
    it('should return 403 Forbidden when User B attempts to update User A address (IDOR protection)', async () => {
      const res = await request(app)
        .put(`/api/v1/users/addresses/${addressA1Id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          city: 'Hacker City',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/does not belong to user/i);
    });

    it('should return 403 Forbidden when User B attempts to delete User A address (IDOR protection)', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/addresses/${addressA1Id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/does not belong to user/i);
    });

    it('should allow User A to successfully delete their own address', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/addresses/${addressA2Id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/deleted successfully/i);

      // Confirm deletion in address list
      const listRes = await request(app)
        .get('/api/v1/users/addresses')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.data[0].id).toBe(addressA1Id);
    });

    it('should return 404 Not Found when deleting a non-existent address ID', async () => {
      const res = await request(app)
        .delete('/api/v1/users/addresses/d0000000-0000-0000-0000-000000000099')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });
  });
});
