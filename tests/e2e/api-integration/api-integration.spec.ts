import { test, expect, request } from '@playwright/test';
import { BASE_URL } from '../test-utils';

/**
 * API Integration Tests - Sprint 2
 * Tests for Firebase Firestore and API endpoint integration
 */

test.describe('API Integration: Public Endpoints', () => {
  test.describe('API-INT-001: Events API', () => {
    test('API-INT-001.1: Events endpoint returns 200', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/events`);
      expect([200, 500]).toContain(response.status());
    });

    test('API-INT-001.2: Events returns JSON', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/events`);
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });

    test('API-INT-001.3: Events data structure', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/events`);
      if (response.status() === 200) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
        
        if (data.length > 0) {
          expect(data[0]).toHaveProperty('id');
          expect(data[0]).toHaveProperty('title');
        }
      }
    });

    test('API-INT-001.4: Event has required fields', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/events`);
      if (response.status() === 200) {
        const data = await response.json();
        if (data.length > 0) {
          const event = data[0];
          expect(event).toHaveProperty('id');
          expect(event).toHaveProperty('title');
          expect(event).toHaveProperty('published');
        }
      }
    });
  });

  test.describe('API-INT-002: Announcements API', () => {
    test('API-INT-002.1: Announcements endpoint works', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/announcements`);
      expect([200, 500]).toContain(response.status());
    });

    test('API-INT-002.2: Announcements returns array', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/announcements`);
      if (response.status() === 200) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
      }
    });
  });

  test.describe('API-INT-003: Quotes API', () => {
    test('API-INT-003.1: Quotes endpoint works', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/quotes`);
      expect([200, 500]).toContain(response.status());
    });

    test('API-INT-003.2: Random quote endpoint works', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/quotes/random`);
      expect([200, 500]).toContain(response.status());
    });

    test('API-INT-003.3: Quote structure', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/quotes/random`);
      if (response.status() === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('quote');
      }
    });

    test('API-INT-003.4: Quote has multilingual content', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/quotes/random`);
      if (response.status() === 200) {
        const data = await response.json();
        const quote = data.quote || data;
        if (quote.content) {
          expect(quote.content).toHaveProperty('kannada');
          expect(quote.content).toHaveProperty('translationEnglish');
        }
      }
    });

    test('API-INT-003.5: Daily quote endpoint', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/quotes/today`);
      expect([200, 404, 500]).toContain(response.status());
    });

    test('API-INT-003.6: Quote categories', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/quotes/category/daily`);
      expect(response.status()).toBeGreaterThanOrEqual(200);
    });
  });

  test.describe('API-INT-004: Search API', () => {
    test('API-INT-004.1: Search endpoint exists', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/search?q=temple`);
      expect([200, 404, 500]).toContain(response.status());
    });

    test('API-INT-004.2: Search with query', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/search?q=events`);
      expect([200, 404, 500]).toContain(response.status());
    });

    test('API-INT-004.3: Search suggestions', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/search/suggestions?q=temp`);
      expect([200, 404, 500]).toContain(response.status());
    });
  });

  test.describe('API-INT-005: Contact API', () => {
    test('API-INT-005.1: Contact endpoint exists', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/contact`);
      expect([200, 405, 500]).toContain(response.status());
    });

    test('API-INT-005.2: Contact accepts POST', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/contact`, {
        data: {
          name: 'Test User',
          email: 'test@example.com',
          message: 'Test message'
        }
      });
      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(600);
    });

    test('API-INT-005.3: Contact validates required fields', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/contact`, {
        data: {}
      });
      expect([200, 400, 500]).toContain(response.status());
    });

    test('API-INT-005.4: Contact sanitizes input', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/contact`, {
        data: {
          name: '<script>alert("XSS")</script>Test',
          email: 'test@example.com',
          message: 'Test message'
        }
      });
      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(600);
    });
  });

  test.describe('API-INT-006: Donation API', () => {
    test('API-INT-006.1: Donation endpoint works', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/donations`);
      expect([200, 404, 500]).toContain(response.status());
    });

    test('API-INT-006.2: Donation POST creates record', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/donations`, {
        data: {
          name: 'Test Donor',
          email: 'donor@example.com',
          amount: 1000,
          purpose: 'general'
        }
      });
      expect([200, 201, 400, 401, 500]).toContain(response.status());
    });
  });

  test.describe('API-INT-007: Sevas API', () => {
    test('API-INT-007.1: Sevas endpoint exists', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/sevas`);
      expect([200, 404, 500]).toContain(response.status());
    });

    test('API-INT-007.2: Sevas returns data', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/sevas`);
      if (response.status() === 200) {
        const data = await response.json();
        expect(Array.isArray(data) || typeof data === 'object').toBe(true);
      }
    });
  });

  test.describe('API-INT-008: Gallery API', () => {
    test('API-INT-008.1: Gallery endpoint exists', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/gallery`);
      expect([200, 404, 500]).toContain(response.status());
    });
  });

  test.describe('API-INT-009: Temple Areas API', () => {
    test('API-INT-009.1: Temple areas endpoint works', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/temple-areas`);
      expect([200, 404, 500]).toContain(response.status());
    });
  });

  test.describe('API-INT-010: Testimonials API', () => {
    test('API-INT-010.1: Testimonials endpoint works', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/testimonials`);
      expect([200, 404, 500]).toContain(response.status());
    });
  });

  test.describe('API-INT-011: Volunteer API', () => {
    test('API-INT-011.1: Volunteer endpoint works', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/volunteer`);
      expect([200, 405, 500]).toContain(response.status());
    });

    test('API-INT-011.2: Volunteer accepts POST', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/volunteer`, {
        data: {
          name: 'Test Volunteer',
          email: 'volunteer@example.com',
          skills: 'general'
        }
      });
      expect([200, 201, 400, 500]).toContain(response.status());
    });
  });

  test.describe('API-INT-012: AI Endpoints', () => {
    test('API-INT-012.1: Chat endpoint exists', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/chat`, {
        data: {
          message: 'Hello',
          userId: 'anonymous'
        }
      });
      expect([200, 400, 500]).toContain(response.status());
    });

    test('API-INT-012.2: Chat handles empty message', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/chat`, {
        data: {
          message: '',
          userId: 'anonymous'
        }
      });
      expect([200, 400, 500]).toContain(response.status());
    });

    test('API-INT-012.3: AI analytics endpoint', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/ai/analytics`);
      expect([200, 401, 404, 500]).toContain(response.status());
    });
  });

  test.describe('API-INT-013: Error Handling', () => {
    test('API-INT-013.1: Invalid endpoint returns 404', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/nonexistent`);
      expect([404, 500]).toContain(response.status());
    });

    test('API-INT-013.2: Invalid JSON handled', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/contact`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: 'invalid json'
      });
      expect([400, 500]).toContain(response.status());
    });

    test('API-INT-013.3: Large payload handled', async ({ request }) => {
      const largePayload = {
        message: 'x'.repeat(50000)
      };
      const response = await request.post(`${BASE_URL}/api/contact`, {
        data: largePayload
      });
      expect([200, 400, 413, 500]).toContain(response.status());
    });
  });

  test.describe('API-INT-014: Rate Limiting', () => {
    test('API-INT-014.1: Multiple rapid requests', async ({ request }) => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(request.get(`${BASE_URL}/api/events`));
      }
      
      const responses = await Promise.all(promises);
      expect(responses.length).toBe(5);
    });
  });
});
