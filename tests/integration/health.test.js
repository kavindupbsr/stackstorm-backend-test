const request = require('supertest');
const app = require('../../src/app');

describe('STORM-003: Health API Integration Tests', () => {
  it('GET /api/v1/health should return HTTP 200 with standardized success envelope', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .expect('Content-Type', /json/)
      .expect(200);

    // Assert top-level JSON:API envelope
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'System is healthy and operational');
    expect(response.body).toHaveProperty('errors', []);
    expect(response.body).toHaveProperty('data');

    // Assert health payload attributes
    const { data } = response.body;
    expect(data).toHaveProperty('service', 'stackstorm-backend');
    expect(data).toHaveProperty('status', 'healthy');
    expect(typeof data.uptime).toBe('number');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('environment');
    expect(data).toHaveProperty('memoryUsage');
    expect(data.memoryUsage).toHaveProperty('rss');
    expect(data.memoryUsage).toHaveProperty('heapTotal');
    expect(data.memoryUsage).toHaveProperty('heapUsed');
  });

  it('GET /api/v1/non-existent-route should return HTTP 404 with standardized error envelope', async () => {
    const response = await request(app)
      .get('/api/v1/non-existent-route')
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('data', null);
    expect(response.body.message).toContain('Route GET /api/v1/non-existent-route not found');
    expect(Array.isArray(response.body.errors)).toBe(true);
  });
});
