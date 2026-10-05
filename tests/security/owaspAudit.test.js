/**
 * StackStorm E-Commerce Platform - Dickwella Fashion Corner
 * OWASP Top 10 Security Audit & Automated Exploit Testing Suite
 *
 * Sprint: Sprint 8 (Week 14) | Module Owner: B.K. Pabasara
 * SRS Ref: NFR-002 (Security Compliance & OWASP Hardening)
 * SDS Ref: §13.3 (Penetration Testing & Security Verification)
 */

const request = require('supertest');
const { execSync } = require('child_process');
const app = require('../../src/app');
const { User, Order } = require('../../src/models');
const { generateAccessToken } = require('../../src/services/token.service');

describe('STORM-047: OWASP Top 10 Security Audit & Penetration Suite', () => {
  let customerA;
  let customerB;
  let tokenA;
  let tokenB;
  let orderA;

  beforeAll(async () => {
    // Seed isolated test customers
    customerA = await User.create({
      email: `security_victim_${Date.now()}@dickwella.lk`,
      password_hash: '$2a$04$e8aQ9aZ8q6w3VzNqM6vK9.U7/7zKzWzKzWzKzWzKzWzKzWzKzWzK.',
      role: 'customer',
      is_active: true,
    });

    customerB = await User.create({
      email: `security_attacker_${Date.now()}@dickwella.lk`,
      password_hash: '$2a$04$e8aQ9aZ8q6w3VzNqM6vK9.U7/7zKzWzKzWzKzWzKzWzKzWzKzWzK.',
      role: 'customer',
      is_active: true,
    });

    tokenA = generateAccessToken(customerA);
    tokenB = generateAccessToken(customerB);

    // Create an isolated order belonging strictly to Customer A
    orderA = await Order.create({
      order_number: `DFC-SEC-${Date.now()}`,
      customer_id: customerA.id,
      order_status: 'pending',
      payment_status: 'paid',
      total_amount: 8500.0,
      shipping_amount: 400.0,
      discount_amount: 0.0,
      shipping_address_snapshot: {
        street: '12 Beach Road',
        city: 'Dickwella',
        postalCode: '81200',
      },
    });
  });

  afterAll(async () => {
    if (orderA) {
      await Order.destroy({ where: { id: orderA.id } });
    }
    if (customerA) {
      await User.destroy({ where: { id: customerA.id } });
    }
    if (customerB) {
      await User.destroy({ where: { id: customerB.id } });
    }
  });

  describe('AC1: Automated Vulnerability & Dependency Scan (A06:2021-Vulnerable Components)', () => {
    it('should report zero high or critical security vulnerabilities in production dependencies', () => {
      let auditOutput = '';
      try {
        auditOutput = execSync('npm audit --omit=dev --audit-level=high', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (err) {
        auditOutput = err.stdout || err.message;
        // If high or critical vulnerabilities exist, npm audit exits with code 1
        expect(err.status).toBe(0);
      }

      expect(auditOutput).not.toMatch(/Severity: high/i);
      expect(auditOutput).not.toMatch(/Severity: critical/i);
    });
  });

  describe('AC2: SQL Injection (SQLi) Defense (A03:2021-Injection)', () => {
    it('should sanitize query parameter SQL injection payloads in catalog search', async () => {
      const sqliPayloads = [
        "' OR '1'='1",
        "' OR 1=1 --",
        "'; DROP TABLE users; --",
        "' UNION SELECT id, email, password_hash FROM users --",
      ];

      for (const payload of sqliPayloads) {
        // eslint-disable-next-line no-await-in-loop
        const res = await request(app).get(
          `/api/v1/products?search=${encodeURIComponent(payload)}`
        );

        // Expect proper handling: HTTP 200 with zero injected data, or 400 bad request
        expect([200, 400]).toContain(res.status);
        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          // Injection should not match all products or expose password hashes
          expect(JSON.stringify(res.body)).not.toMatch(/password_hash/i);
          expect(JSON.stringify(res.body)).not.toMatch(/DROP TABLE/i);
        }
      }
    });

    it('should reject path parameter SQL injection attempts with 400 or 404 without SQL error leaks', async () => {
      const maliciousId = "b0000000-0000-0000-0000-000000000001' OR 1=1 --";
      const res = await request(app).get(`/api/v1/products/${encodeURIComponent(maliciousId)}`);

      expect([400, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
      // Ensure database stack traces and internal query statements are suppressed
      expect(JSON.stringify(res.body)).not.toMatch(/SequelizeDatabaseError/i);
      expect(JSON.stringify(res.body)).not.toMatch(/syntax error at or near/i);
    });

    it('should sanitize login credentials and reject SQLi authentication bypass payloads', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: "' OR '1'='1' --",
          password: 'Password123!',
        });

      // Must fail with 400 (validation error) or 401 (unauthorized)
      expect([400, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(res.body.data?.accessToken).toBeUndefined();
    });
  });

  describe('AC3: Cross-Site Scripting (XSS) & Helmet Security Headers (A05:2021-Security Misconfiguration)', () => {
    it('should neutralize XSS payloads in chatbot and public queries', async () => {
      const xssPayloads = [
        '<script>alert("XSS_ATTACK")</script>',
        '<img src=x onerror=alert(1)>',
        '"><svg onload=alert(document.cookie)>',
      ];

      for (const payload of xssPayloads) {
        // eslint-disable-next-line no-await-in-loop
        const res = await request(app)
          .post('/api/v1/chat/bot-query')
          .send({ message: payload });

        expect([200, 400]).toContain(res.status);
        if (res.status === 200) {
          // Assert server did not mirror malicious executable scripts
          expect(res.body.data.reply).not.toContain('<script>alert');
        }
      }
    });

    it('should enforce strict Helmet HTTP security headers across API endpoints', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);

      // Mozilla Observatory & OWASP Top 10 Grade A+ HTTP Header Assertions:
      // 1. Anti-Clickjacking
      expect(res.headers['x-frame-options']).toBe('DENY');
      // 2. MIME type sniffing prevention
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      // 3. Strict Transport Security (HSTS)
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
      // 4. Content Security Policy (CSP)
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    });
  });

  describe('AC4: Insecure Direct Object References (IDOR) & Broken Access Control (A01:2021-Broken Access Control)', () => {
    it("should prevent Customer B from viewing Customer A's order details (GET /api/v1/orders/:id)", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderA.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      // Must be rejected with 403 Forbidden or 404 Not Found
      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(res.body.data?.order_number).toBeUndefined();
    });

    it("should prevent Customer B from viewing Customer A's order tracking (GET /api/v1/orders/:id/track)", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderA.id}/track`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it("should prevent Customer B from mutating or cancelling Customer A's order", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${orderA.id}/cancel`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ reason: 'Malicious cancellation attempt' });

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should reject unprivileged customers attempting to access Admin endpoints (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
