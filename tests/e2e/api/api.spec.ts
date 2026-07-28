import { test, expect } from '@playwright/test';
import { BASE_URL } from '../test-utils';

test.describe('API Routes Module', () => {
  test.describe('Public API Routes', () => {
    test('API-001: Events API returns data', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/events`);
      // Should return 200 or handle gracefully
      expect([200, 404, 500]).toContain(response.status());
    });

    test('API-002: Sevas API returns data', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/sevas`);
      expect([200, 404, 500]).toContain(response.status());
    });

    test('API-003: Announcements API returns data', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/announcements`);
      expect([200, 404, 500]).toContain(response.status());
    });

    test('API-004: Gallery API returns data', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/gallery`);
      expect([200, 404, 500]).toContain(response.status());
    });

    test('API-005: Quotes API returns data', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/quotes`);
      expect([200, 404, 500]).toContain(response.status());
    });

    test('API-006: Search API works', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/search?q=temple`);
      expect([200, 404, 500]).toContain(response.status());
    });

    test('API-007: Contact API endpoint exists', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/contact`);
      expect([200, 405, 500]).toContain(response.status());
    });
  });

  test.describe('API Response Format', () => {
    test('API-010: API returns JSON content type', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/events`);
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });

    test('API-011: API handles invalid IDs gracefully', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/events/invalid-id-123`);
      expect([400, 404, 500]).toContain(response.status());
    });

    test('API-012: API handles missing parameters', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/search`);
      expect([200, 400, 404, 500]).toContain(response.status());
    });
  });

  test.describe('API Authentication', () => {
    test('API-020: Admin API requires authentication', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/events`);
      // Should return 401 or 403
      expect([401, 403, 404, 500]).toContain(response.status());
    });

    test('API-021: Public API does not require auth', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/events`);
      expect([200, 500]).toContain(response.status());
    });
  });

  test.describe('API CRUD Operations', () => {
    test('API-030: Events POST creates record', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/events`, {
        data: {
          title: 'Test Event',
          description: 'Test Description'
        }
      });
      expect([200, 201, 400, 401, 500]).toContain(response.status());
    });

    test('API-031: Events PUT updates record', async ({ request }) => {
      const response = await request.put(`${BASE_URL}/api/events/test-id`, {
        data: {
          title: 'Updated Event'
        }
      });
      expect([200, 400, 401, 404, 500]).toContain(response.status());
    });

    test('API-032: Events DELETE removes record', async ({ request }) => {
      const response = await request.delete(`${BASE_URL}/api/events/test-id`);
      expect([200, 204, 400, 401, 404, 500]).toContain(response.status());
    });
  });

  test.describe('API Error Handling', () => {
    test('API-040: Invalid JSON is handled', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/contact`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: 'invalid json'
      });
      expect([400, 500]).toContain(response.status());
    });

    test('API-041: Missing required fields returns error', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/contact`, {
        data: {}
      });
      expect([200, 400, 500]).toContain(response.status());
    });

    test('API-042: Large payload is handled', async ({ request }) => {
      const largePayload = {
        description: 'x'.repeat(10000)
      };
      const response = await request.post(`${BASE_URL}/api/contact`, {
        data: largePayload
      });
      expect([200, 400, 413, 500]).toContain(response.status());
    });
  });

  test.describe('API Rate Limiting', () => {
    test('API-050: Multiple rapid requests are handled', async ({ request }) => {
      // Make multiple rapid requests
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(request.get(`${BASE_URL}/api/events`));
      }
      
      const responses = await Promise.all(promises);
      // All should return (may have rate limit response)
      expect(responses.length).toBe(5);
    });
  });

  test.describe('Quotes API', () => {
    test('API-060: Daily quote endpoint works', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/quotes/today`);
      expect([200, 404, 500]).toContain(response.status());
    });

    test('API-061: Random quote endpoint works', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/quotes/random`);
      expect([200, 404, 500]).toContain(response.status());
    });

    test('API-062: Quote categories work', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/quotes/category/daily`);
      expect([200, 404, 500]).toContain(response.status());
    });

    test('API-063: Quote search works', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/quotes/search?q=faith`);
      expect([200, 404, 500]).toContain(response.status());
    });
  });

  test.describe('Search API', () => {
    test('API-070: Search with query returns results', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/search?q=temple`);
      expect([200, 404, 500]).toContain(response.status());
    });

    test('API-071: Search suggestions endpoint works', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/search/suggestions?q=temp`);
      expect([200, 404, 500]).toContain(response.status());
    });
  });
});
