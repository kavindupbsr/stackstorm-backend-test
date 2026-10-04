const request = require('supertest');
const app = require('../../src/app');

describe('Integration: Security Headers & CORS Policy (STORM-016)', () => {
  describe('Helmet HTTP Security Headers', () => {
    it('should set X-Content-Type-Options: nosniff to prevent MIME sniffing', async () => {
      const response = await request(app).get('/api/v1/health');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set X-Frame-Options: DENY to prevent clickjacking', async () => {
      const response = await request(app).get('/api/v1/health');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should set Strict-Transport-Security (HSTS) with includeSubDomains and preload', async () => {
      const response = await request(app).get('/api/v1/health');
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    });

    it('should set Content-Security-Policy (CSP) headers', async () => {
      const response = await request(app).get('/api/v1/health');
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });

    it('should set X-XSS-Protection: 0 to disable legacy buggy browser XSS filters', async () => {
      const response = await request(app).get('/api/v1/health');
      expect(response.headers['x-xss-protection']).toBe('0');
    });
  });

  describe('CORS Whitelist Enforcement', () => {
    it('should allow whitelisted customer frontend origin', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should allow whitelisted admin frontend origin', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:3001');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should not set Access-Control-Allow-Origin for unauthorized third-party origins', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://malicious-phishing-site.com');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should allow non-browser requests without an Origin header (mobile apps, curl)', async () => {
      const response = await request(app).get('/api/v1/health');
      expect(response.status).toBe(200);
    });
  });
});
