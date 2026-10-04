const request = require('supertest');
const app = require('../../src/app');

describe('STORM-004: Global Error & 404 Handling Integration Tests', () => {
  it('should intercept 404 for unmapped route and return standardized error envelope', async () => {
    const response = await request(app)
      .get('/api/v1/non-existent-route')
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body).toEqual({
      success: false,
      data: null,
      message: 'Resource not found: GET /api/v1/non-existent-route',
      errors: [],
    });
  });

  it('should handle operational 400 error and return structured validation errors', async () => {
    const response = await request(app)
      .get('/api/v1/test-error/400')
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.data).toBeNull();
    expect(response.body.message).toBe('Deliberate 400 Validation Error');
    expect(response.body.errors).toEqual([{ field: 'email', message: 'Invalid email' }]);
    expect(response.body.stack).toBeUndefined();
  });

  it('should handle unhandled 500 error gracefully and suppress stack traces', async () => {
    const response = await request(app)
      .get('/api/v1/test-error/500')
      .expect('Content-Type', /json/)
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.data).toBeNull();
    expect(response.body.errors).toEqual([]);
    expect(response.body.stack).toBeUndefined();
  });
});
