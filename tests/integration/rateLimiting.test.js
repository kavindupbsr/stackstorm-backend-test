const request = require('supertest');
const app = require('../../src/app');

describe('Integration: Tiered Rate Limiting Barrier (STORM-016)', () => {
  beforeAll(() => {
    process.env.TEST_RATE_LIMIT = 'true';
  });

  afterAll(() => {
    delete process.env.TEST_RATE_LIMIT;
  });

  describe('Auth Rate Limiter (5 requests / 15 minutes quota)', () => {
    it('should allow first 5 requests and reject the 6th with HTTP 429 Too Many Requests', async () => {
      const sendReq = () =>
        request(app)
          .post('/api/v1/auth/register')
          .set('X-Forwarded-For', '203.0.113.195')
          .send({ email: 'invalid-email' });

      // First 5 requests should reach the endpoint within quota (returning 400 for invalid body, not 429)
      const res1 = await sendReq();
      expect(res1.status).not.toBe(429);

      const res2 = await sendReq();
      expect(res2.status).not.toBe(429);

      const res3 = await sendReq();
      expect(res3.status).not.toBe(429);

      const res4 = await sendReq();
      expect(res4.status).not.toBe(429);

      const res5 = await sendReq();
      expect(res5.status).not.toBe(429);

      // 6th request from the same IP address must trigger HTTP 429
      const res6 = await request(app)
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '203.0.113.195')
        .send({
          email: 'invalid-email',
        });

      expect(res6.status).toBe(429);
      expect(res6.body.success).toBe(false);
      expect(res6.body.message).toMatch(/Too many authentication attempts/i);
      expect(Array.isArray(res6.body.errors)).toBe(true);
      expect(res6.body.errors[0].field).toBe('rateLimit');
    });

    it('should include Retry-After header on 429 responses', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '203.0.113.195')
        .send({ email: 'test@dickwella.lk' });

      expect(res.status).toBe(429);
      expect(res.headers['retry-after']).toBeDefined();
    });
  });
});
