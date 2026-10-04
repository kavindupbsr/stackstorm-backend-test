const request = require('supertest');
const app = require('../../src/app');
const redisClient = require('../../src/config/redis');
const reservationService = require('../../src/services/reservation.service');
const { runExpirySweep } = require('../../src/jobs/reservationExpiry.job');
const { ProductVariant, sequelize } = require('../../src/models');

describe('Integration: 15-Minute Temporary Stock Reservation System (STORM-024)', () => {
  const variantId = 'd0000000-0000-0000-0000-000000000001'; // Batik Shirt M (Stock: 25, Reserved: 0)

  beforeEach(async () => {
    reservationService.fallbackReservations.clear();
    reservationService.fallbackStockTracker.clear();

    // Reset database variant stock if connected
    try {
      await ProductVariant.update(
        { stock_quantity: 25, reserved_quantity: 0 },
        { where: { id: variantId } }
      );
    } catch {
      // Ignore if offline
    }
  });

  afterAll(async () => {
    try {
      reservationService.fallbackReservations.clear();
      reservationService.fallbackStockTracker.clear();
      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore cleanup error if already closed
    }
  });

  describe('POST /api/v1/checkout/reserve (Happy Path & Stock Decrement)', () => {
    it('should reserve stock for 15 minutes, incrementing reserved_quantity immediately', async () => {
      const response = await request(app).post('/api/v1/checkout/reserve').send({
        variant_id: variantId,
        quantity: 2,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('reservation_id');
      expect(response.body.data.expires_in).toBe(900);
      expect(response.body.data).toHaveProperty('expires_at');
      expect(response.body.data.items[0].quantity).toBe(2);

      const reservationId = response.body.data.reservation_id;

      // Assert Redis holds active reservation key with 900s TTL
      const redisRaw = await redisClient.get(`reservation:${reservationId}`);
      expect(redisRaw).not.toBeNull();
      const parsed = JSON.parse(redisRaw);
      expect(parsed.reservation_id).toBe(reservationId);
      expect(parsed.status).toBe('ACTIVE');

      // Assert available stock decremented (25 - 2 = 23)
      const isAvailableFor24 = await reservationService.checkAvailability(variantId, 24);
      expect(isAvailableFor24).toBe(false);

      const isAvailableFor23 = await reservationService.checkAvailability(variantId, 23);
      expect(isAvailableFor23).toBe(true);
    });
  });

  describe('Overselling Prevention & 409 Conflict Handling', () => {
    it('should reject reservation with 409 Conflict when requested quantity exceeds available stock', async () => {
      // Available is 25, request 30
      const response = await request(app).post('/api/v1/checkout/reserve').send({
        variant_id: variantId,
        quantity: 30,
      });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/Insufficient stock available/i);
    });

    it('should prevent race conditions on concurrent reservations: first customer succeeds, second receives 409', async () => {
      // Set remaining available stock to exactly 1 unit
      try {
        await ProductVariant.update(
          { stock_quantity: 1, reserved_quantity: 0 },
          { where: { id: variantId } }
        );
      } catch {
        // Fallback tracker
        reservationService.fallbackStockTracker.set(variantId, { stock: 1, reserved: 0 });
      }

      // Customer A and Customer B both attempt to reserve the 1 remaining unit simultaneously
      const [resCustomerA, resCustomerB] = await Promise.all([
        request(app).post('/api/v1/checkout/reserve').send({ variant_id: variantId, quantity: 1 }),
        request(app).post('/api/v1/checkout/reserve').send({ variant_id: variantId, quantity: 1 }),
      ]);

      const statuses = [resCustomerA.status, resCustomerB.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(409);
    });
  });

  describe('Payment Confirmation & Permanent Stock Deduction (AC3)', () => {
    it('should permanently deduct stock_quantity and reserved_quantity upon payment confirmation', async () => {
      // 1. Reserve 3 units
      const reserveRes = await request(app)
        .post('/api/v1/checkout/reserve')
        .send({ variant_id: variantId, quantity: 3 });

      const reservationId = reserveRes.body.data.reservation_id;

      // 2. Confirm reservation
      const confirmRes = await request(app)
        .post(`/api/v1/checkout/confirm/${reservationId}`)
        .send();

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.success).toBe(true);

      // Verify Redis key is purged
      const redisCheck = await redisClient.get(`reservation:${reservationId}`);
      expect(redisCheck).toBeNull();

      // Verify database or tracker reflects permanent reduction (25 - 3 = 22)
      const stockInfo = await reservationService.getVariantStock(variantId);
      expect(stockInfo.stock_quantity).toBe(22);
      expect(stockInfo.reserved_quantity).toBe(0);
    });
  });

  describe('Cancellation, Expiry & Stock Release (AC4)', () => {
    it('should revert reserved_quantity when reservation is released or cancelled', async () => {
      // 1. Reserve 4 units
      const reserveRes = await request(app)
        .post('/api/v1/checkout/reserve')
        .send({ variant_id: variantId, quantity: 4 });

      const reservationId = reserveRes.body.data.reservation_id;

      // 2. Release reservation
      const releaseRes = await request(app)
        .post(`/api/v1/checkout/release/${reservationId}`)
        .send();

      expect(releaseRes.status).toBe(200);

      // Verify available stock is restored to full 25
      const stockInfo = await reservationService.getVariantStock(variantId);
      expect(stockInfo.reserved_quantity).toBe(0);
      expect(stockInfo.availableStock).toBe(25);
    });

    it('background sweep job should automatically release expired reservations', async () => {
      // Reserve with simulated expired timestamp in fallback
      const expiredId = 'res_expired_test_001';
      reservationService.fallbackReservations.set(expiredId, {
        reservation_id: expiredId,
        items: [{ variant_id: variantId, quantity: 5 }],
        expires_at: new Date(Date.now() - 1000).toISOString(), // expired 1s ago
        status: 'ACTIVE',
      });
      reservationService.fallbackStockTracker.set(variantId, { stock: 25, reserved: 5 });

      const sweptCount = await runExpirySweep();
      expect(sweptCount).toBeGreaterThanOrEqual(1);

      // Verify reservation was purged
      expect(reservationService.fallbackReservations.has(expiredId)).toBe(false);

      // Verify stock was restored
      const tracked = reservationService.fallbackStockTracker.get(variantId);
      expect(tracked.reserved).toBe(0);
    });
  });
});
