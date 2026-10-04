const request = require('supertest');
const path = require('path');
const app = require('../../src/app');
const redisClient = require('../../src/config/redis');
const { sequelize } = require('../../src/models');
const { generateAccessToken } = require('../../src/services/token.service');
const { ROLES } = require('../../src/config/constants');

describe('Integration: S3 / Multer Image Upload Pipeline (STORM-021)', () => {
  let authToken;

  beforeAll(() => {
    authToken = generateAccessToken({
      id: 'usr-admin-uuid-001',
      email: 'admin@dickwellafashion.lk',
      role: ROLES.ADMIN,
    });
  });

  afterAll(async () => {
    try {
      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore cleanup error if already closed
    }
  });

  describe('POST /api/v1/upload/images', () => {
    it('should reject unauthenticated upload requests with HTTP 401', async () => {
      const response = await request(app).post('/api/v1/upload/images');
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject requests with no files uploaded with HTTP 400', async () => {
      const response = await request(app)
        .post('/api/v1/upload/images')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No files were uploaded');
    });

    it('should reject files with unsupported MIME types (e.g. application/pdf) with HTTP 400', async () => {
      const pdfPath = path.join(__dirname, '../fixtures/invalid-doc.pdf');

      const response = await request(app)
        .post('/api/v1/upload/images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('images', pdfPath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Only JPEG, PNG and WebP are allowed');
    });

    it('should successfully upload valid image and return HTTP 201 with array of URLs', async () => {
      const pngPath = path.join(__dirname, '../fixtures/sample-shirt.png');

      const response = await request(app)
        .post('/api/v1/upload/images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('images', pngPath);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Images uploaded successfully');
      expect(response.body.data).toHaveProperty('urls');
      expect(Array.isArray(response.body.data.urls)).toBe(true);
      expect(response.body.data.urls.length).toBe(1);
      expect(response.body.data.urls[0]).toMatch(/^https?:\/\//);
    });
  });
});
