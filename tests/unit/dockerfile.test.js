/**
 * StackStorm E-Commerce Platform - Dickwella Fashion Corner
 * Shift-Left Dockerfile & Container Architecture Unit Tests
 *
 * Sprint: Sprint 8 (Week 15) | Module Owner: Lakshani A.T.
 * SRS Ref: NFR-016 (Deployment Architecture & Containerization)
 * SDS Ref: §13.4 (Production Container Topology & Cloud Deployment)
 */

const fs = require('fs');
const path = require('path');

describe('STORM-048: Multi-Stage Dockerfile & Cloud Deployment Architecture', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const dockerfilePath = path.join(rootDir, 'Dockerfile');
  const dockerComposeProdPath = path.join(rootDir, 'docker-compose.prod.yml');
  const nginxConfPath = path.join(rootDir, 'nginx/nginx.conf');
  const dockerignorePath = path.join(rootDir, '.dockerignore');

  describe('Multi-Stage Production Dockerfile (AC1)', () => {
    let dockerfileContent;

    beforeAll(() => {
      expect(fs.existsSync(dockerfilePath)).toBe(true);
      dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
    });

    it('should define a multi-stage build using node:20-alpine as builder and runner', () => {
      expect(dockerfileContent).toMatch(/FROM\s+node:20-alpine\s+AS\s+builder/i);
      expect(dockerfileContent).toMatch(/FROM\s+node:20-alpine\s+AS\s+runner/i);
    });

    it('should exclude devDependencies during production install in builder stage', () => {
      expect(dockerfileContent).toMatch(/npm\s+ci\s+--omit=dev/i);
    });

    it('should enforce non-root security execution using USER node', () => {
      expect(dockerfileContent).toMatch(/USER\s+node/i);
    });

    it('should integrate dumb-init for PID 1 signal forwarding and graceful SIGTERM handling', () => {
      expect(dockerfileContent).toMatch(/dumb-init/i);
      expect(dockerfileContent).toMatch(/ENTRYPOINT\s+\[.*dumb-init.*\]/i);
    });

    it('should expose backend application port 5000 and configure Docker HEALTHCHECK', () => {
      expect(dockerfileContent).toMatch(/EXPOSE\s+5000/i);
      expect(dockerfileContent).toMatch(/HEALTHCHECK/i);
    });

    it('should have a corresponding .dockerignore excluding node_modules, tests, and env secrets', () => {
      expect(fs.existsSync(dockerignorePath)).toBe(true);
      const dockerignore = fs.readFileSync(dockerignorePath, 'utf8');
      expect(dockerignore).toMatch(/node_modules/i);
      expect(dockerignore).toMatch(/\.env/i);
      expect(dockerignore).toMatch(/tests/i);
    });
  });

  describe('Production Nginx Reverse Proxy Configuration (AC2)', () => {
    let nginxConfContent;

    beforeAll(() => {
      expect(fs.existsSync(nginxConfPath)).toBe(true);
      nginxConfContent = fs.readFileSync(nginxConfPath, 'utf8');
    });

    it('should configure an upstream backend pool targeting backend:5000', () => {
      expect(nginxConfContent).toMatch(/upstream\s+backend_nodes/i);
      expect(nginxConfContent).toMatch(/server\s+backend:5000/i);
    });

    it('should enable Gzip compression for JSON, CSS, JS, and HTML web assets', () => {
      expect(nginxConfContent).toMatch(/gzip\s+on;/i);
      expect(nginxConfContent).toMatch(/application\/json/i);
      expect(nginxConfContent).toMatch(/application\/javascript/i);
    });

    it('should configure Tier-1 IP rate limiting for API protection', () => {
      expect(nginxConfContent).toMatch(/limit_req_zone/i);
      expect(nginxConfContent).toMatch(/limit_req\s+zone=/i);
    });

    it('should configure WebSocket / Socket.IO upgrade proxying', () => {
      expect(nginxConfContent).toMatch(/proxy_set_header\s+Upgrade\s+\$http_upgrade;/i);
      expect(nginxConfContent).toMatch(/proxy_set_header\s+Connection\s+"upgrade";/i);
    });

    it('should enforce HTTP security headers (X-Frame-Options, nosniff)', () => {
      expect(nginxConfContent).toMatch(/add_header\s+X-Frame-Options\s+"DENY"/i);
      expect(nginxConfContent).toMatch(/add_header\s+X-Content-Type-Options\s+"nosniff"/i);
    });
  });

  describe('Production Container Topology Orchestration (AC3)', () => {
    let composeContent;

    beforeAll(() => {
      expect(fs.existsSync(dockerComposeProdPath)).toBe(true);
      composeContent = fs.readFileSync(dockerComposeProdPath, 'utf8');
    });

    it('should define all 4 production stack services: nginx, backend, postgres, and redis', () => {
      expect(composeContent).toMatch(/nginx:/i);
      expect(composeContent).toMatch(/backend:/i);
      expect(composeContent).toMatch(/postgres:/i);
      expect(composeContent).toMatch(/redis:/i);
    });

    it('should configure dependency healthchecks on backend service', () => {
      expect(composeContent).toMatch(/condition:\s+service_healthy/i);
    });

    it('should define persistent storage volumes for postgres and redis data', () => {
      expect(composeContent).toMatch(/postgres_prod_data:/i);
      expect(composeContent).toMatch(/redis_prod_data:/i);
    });
  });
});
