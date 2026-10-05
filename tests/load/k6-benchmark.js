/**
 * StackStorm E-Commerce Platform - Dickwella Fashion Corner
 * NFR-014 Load & Concurrency Benchmark (500 Concurrent Virtual Users)
 *
 * Sprint: Sprint 8 (Week 14) | Module Owner: S. Thanoogithan
 * SRS Ref: NFR-014 (System Performance Under 500 Concurrent Users)
 * SDS Ref: §13.2 (Load Testing & Capacity Benchmarking)
 *
 * Target: Peak 500 Virtual Users (VUs) sustaining read/write transactions
 * Threshold: p95 latency < 500ms, Error rate < 1%
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000/api/v1';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Warmup stage: ramp to 50 VUs
    { duration: '1m', target: 200 }, // Ramp up: reach 200 VUs
    { duration: '1m', target: 500 }, // Peak load: scale to 500 concurrent VUs
    { duration: '2m', target: 500 }, // Sustained peak load: maintain 500 VUs for 2 minutes
    { duration: '30s', target: 0 }, // Cooldown / ramp down stage
  ],
  thresholds: {
    // NFR-014: 95th percentile response times remain strictly under 500ms at peak load
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    // Overall request failure rate must be under 1%
    http_req_failed: ['rate<0.01'],
    // Catalog browsing p95 latency must be strictly under 200ms (AC2)
    'http_req_duration{endpoint:catalog}': ['p(95)<200'],
    // Health probe p95 latency must be strictly under 50ms
    'http_req_duration{endpoint:health}': ['p(95)<50'],
  },
};

export default function () {
  // Scenario 1: Health check endpoint probe
  group('01_Health_Probe', () => {
    const res = http.get(`${BASE_URL}/health`, {
      tags: { endpoint: 'health' },
    });
    check(res, {
      'health status is 200': (r) => r.status === 200,
      'health latency is < 50ms': (r) => r.timings.duration < 50,
    });
  });

  sleep(0.5);

  // Scenario 2: Catalog Browsing & Search (High Volume Read Load - AC2)
  group('02_Catalog_Browsing', () => {
    const searchTerms = ['Linen', 'Batik', 'Shirt', 'Casual', 'Silk'];
    const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];

    const res = http.get(
      `${BASE_URL}/products?search=${randomTerm}&page=1&limit=12`,
      {
        tags: { endpoint: 'catalog' },
      }
    );

    check(res, {
      'catalog status is 200': (r) => r.status === 200,
      'catalog response has success': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status === 'success' || body.success === true;
        } catch {
          return false;
        }
      },
      'catalog latency p95 is < 200ms': (r) => r.timings.duration < 200,
    });
  });

  sleep(1);

  // Scenario 3: FAQ Chatbot Intent Evaluation (Read/NLP Load)
  group('03_Chatbot_Query', () => {
    const payload = JSON.stringify({
      message: 'What are your store opening hours?',
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
      },
      tags: { endpoint: 'chatbot' },
    };

    const res = http.post(`${BASE_URL}/chat/bot-query`, payload, params);

    check(res, {
      'chatbot query is 200': (r) => r.status === 200,
      'chatbot response has reply': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.reply;
        } catch {
          return false;
        }
      },
    });
  });

  sleep(1);
}
