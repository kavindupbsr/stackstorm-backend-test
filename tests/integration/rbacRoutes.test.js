const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/services/token.service');
const { ROLES } = require('../../src/config/constants');

describe('Integration: Role-Based Access Control (RBAC) Route Guards', () => {
  let customerToken;
  let adminToken;
  let inventoryToken;

  beforeAll(() => {
    customerToken = generateAccessToken({
      id: 'usr-customer-uuid-001',
      email: 'customer@dickwellafashion.lk',
      role: ROLES.CUSTOMER,
    });

    adminToken = generateAccessToken({
      id: 'usr-admin-uuid-001',
      email: 'admin@dickwellafashion.lk',
      role: ROLES.ADMIN,
    });

    inventoryToken = generateAccessToken({
      id: 'usr-inventory-uuid-001',
      email: 'inventory@dickwellafashion.lk',
      role: ROLES.INVENTORY,
    });
  });

  describe('Unauthenticated Access Guards', () => {
    it('GET /api/v1/admin/metrics should return 401 Unauthorized without token', async () => {
      const response = await request(app).get('/api/v1/admin/metrics');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/token is required/i);
    });

    it('POST /api/v1/inventory/adjust-stock should return 401 Unauthorized without token', async () => {
      const response = await request(app)
        .post('/api/v1/inventory/adjust-stock')
        .send({ sku: 'DF-SKU-01', delta: 5 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Admin-Only Routes: GET /api/v1/admin/metrics', () => {
    it('should return 403 Forbidden when customer requests admin metrics', async () => {
      const response = await request(app)
        .get('/api/v1/admin/metrics')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied: insufficient permissions');
    });

    it('should return 403 Forbidden when inventory staff requests admin metrics', async () => {
      const response = await request(app)
        .get('/api/v1/admin/metrics')
        .set('Authorization', `Bearer ${inventoryToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied: insufficient permissions');
    });

    it('should return 200 OK when administrator requests admin metrics', async () => {
      const response = await request(app)
        .get('/api/v1/admin/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics).toBeDefined();
      expect(response.body.data.metrics.currency).toBe('LKR');
    });
  });

  describe('Admin-Only Routes: GET /api/v1/admin/users', () => {
    it('should return 403 Forbidden for inventory staff', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${inventoryToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 200 OK for administrator', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.users.length).toBeGreaterThan(0);
    });
  });

  describe('Inventory Routes: POST /api/v1/inventory/adjust-stock', () => {
    it('should return 403 Forbidden when customer attempts stock adjustment', async () => {
      const response = await request(app)
        .post('/api/v1/inventory/adjust-stock')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ sku: 'DF-SKU-01', delta: 10 });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied: insufficient permissions');
    });

    it('should return 200 OK when inventory staff adjusts stock', async () => {
      const response = await request(app)
        .post('/api/v1/inventory/adjust-stock')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ sku: 'DF-SKU-BATIK-01', delta: 15 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sku).toBe('DF-SKU-BATIK-01');
      expect(response.body.data.updatedBy).toBe('inventory@dickwellafashion.lk');
    });

    it('should return 200 OK when administrator adjusts stock', async () => {
      const response = await request(app)
        .post('/api/v1/inventory/adjust-stock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sku: 'DF-SKU-BATIK-01', delta: -5 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.updatedBy).toBe('admin@dickwellafashion.lk');
    });
  });

  describe('Inventory Routes: GET /api/v1/inventory/status', () => {
    it('should return 403 Forbidden for customer', async () => {
      const response = await request(app)
        .get('/api/v1/inventory/status')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 200 OK for inventory staff', async () => {
      const response = await request(app)
        .get('/api/v1/inventory/status')
        .set('Authorization', `Bearer ${inventoryToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.warehouse).toBe('Dickwella Central Warehouse');
    });
  });
});
