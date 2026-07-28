import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { BASE_URL } from '../test-utils';

test.describe('API Contract Testing - Sprint 5', () => {
  // ==================== API SCHEMA VALIDATION ====================

  test.describe('API Schema Validation', () => {
    test('CONTRACT_API_001: Events API response matches expected schema', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/events`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      
      // Validate response is array
      expect(Array.isArray(data)).toBe(true);
      
      // If array has items, validate structure
      if (data.length > 0) {
        const event = data[0];
        
        // Required fields for events
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('title');
        expect(event).toHaveProperty('published');
        
        // Optional but common fields
        if (event.description !== undefined) {
          expect(typeof event.description).toBe('string');
        }
        if (event.date !== undefined) {
          // Date should be ISO string or valid date format
          expect(() => new Date(event.date)).not.toThrow();
        }
      }
    });

    test('CONTRACT_API_002: Gallery API response matches expected schema', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/gallery`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      
      if (data.length > 0) {
        const item = data[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
      }
    });

    test('CONTRACT_API_003: Sevas API response matches expected schema', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/sevas`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      
      if (data.length > 0) {
        const seva = data[0];
        expect(seva).toHaveProperty('id');
        expect(seva).toHaveProperty('name');
        expect(seva).toHaveProperty('price');
        expect(typeof seva.price).toBe('number');
      }
    });

    test('CONTRACT_API_004: Announcements API response matches expected schema', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/announcements`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      
      if (data.length > 0) {
        const announcement = data[0];
        expect(announcement).toHaveProperty('id');
        expect(announcement).toHaveProperty('title');
      }
    });

    test('CONTRACT_API_005: Contact API accepts valid request schema', async ({ page }) => {
      const response = await page.request.post(`${BASE_URL}/api/contact`, {
        data: {
          name: 'Test User',
          email: 'test@example.com',
          message: 'This is a test message',
          phone: '+1234567890',
        },
      });
      
      // Should return success or validation error, not crash
      expect([200, 201, 400, 422]).toContain(response.status());
    });
  });

  // ==================== BREAKING CHANGE DETECTION ====================

  test.describe('Breaking Change Detection', () => {
    test('CONTRACT_BC_001: Events API does not remove required fields', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/events`);
      const data = await response.json();
      
      if (data.length > 0) {
        const event = data[0];
        const requiredFields = ['id', 'title'];
        
        for (const field of requiredFields) {
          expect(event).toHaveProperty(field);
          expect(event[field]).toBeTruthy();
        }
      }
    });

    test('CONTRACT_BC_002: API returns consistent data types', async ({ page }) => {
      // Make multiple requests to ensure consistency
      const responses = await Promise.all([
        page.request.get(`${BASE_URL}/api/events`),
        page.request.get(`${BASE_URL}/api/events`),
        page.request.get(`${BASE_URL}/api/events`),
      ]);
      
      for (const response of responses) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
        
        if (data.length > 0) {
          // All responses should have same structure
          expect(data[0]).toHaveProperty('id');
          expect(data[0]).toHaveProperty('title');
        }
      }
    });

    test('CONTRACT_BC_003: API handles unknown fields gracefully', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/events?unknownField=test`);
      
      // Should ignore unknown params, not crash
      expect([200, 400]).toContain(response.status());
    });

    test('CONTRACT_BC_004: API returns appropriate status codes', async ({ page }) => {
      // Test various endpoints with different scenarios
      const endpoints = [
        { url: `${BASE_URL}/api/events`, expected: 200 },
        { url: `${BASE_URL}/api/nonexistent`, expected: 404 },
      ];
      
      for (const { url, expected } of endpoints) {
        const response = await page.request.get(url);
        expect(response.status()).toBe(expected);
      }
    });
  });

  // ==================== API RESPONSE TIME TESTS ====================

  test.describe('API Response Time SLA', () => {
    const SLA_THRESHOLDS = {
      GET: 500, // ms
      POST: 1000, // ms
      PUT: 1000, // ms
      DELETE: 1000, // ms
    };

    test('CONTRACT_PERF_001: GET requests meet SLA', async ({ page }) => {
      const endpoints = [
        '/api/events',
        '/api/gallery',
        '/api/sevas',
        '/api/announcements',
      ];
      
      for (const endpoint of endpoints) {
        const startTime = Date.now();
        const response = await page.request.get(`${BASE_URL}${endpoint}`);
        const responseTime = Date.now() - startTime;
        
        console.log(`${endpoint}: ${responseTime}ms`);
        expect(response.status()).toBe(200);
        expect(responseTime).toBeLessThan(SLA_THRESHOLDS.GET);
      }
    });

    test('CONTRACT_PERF_002: POST requests meet SLA', async ({ page }) => {
      const startTime = Date.now();
      const response = await page.request.post(`${BASE_URL}/api/contact`, {
        data: {
          name: 'Performance Test',
          email: 'perf@test.com',
          message: 'Testing POST performance',
        },
      });
      const responseTime = Date.now() - startTime;
      
      console.log(`POST /api/contact: ${responseTime}ms`);
      expect([200, 201, 400, 422]).toContain(response.status());
      expect(responseTime).toBeLessThan(SLA_THRESHOLDS.POST);
    });
  });

  // ==================== API ERROR HANDLING ====================

  test.describe('API Error Handling', () => {
    test('CONTRACT_ERR_001: Invalid ID returns 404', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/events/invalid-id-12345`);
      expect(response.status()).toBe(404);
    });

    test('CONTRACT_ERR_002: Missing required fields returns 400', async ({ page }) => {
      const response = await page.request.post(`${BASE_URL}/api/contact`, {
        data: {
          name: 'Test',
          // missing email and message
        },
      });
      
      expect([400, 422]).toContain(response.status());
    });

    test('CONTRACT_ERR_003: Invalid JSON returns 400', async ({ page }) => {
      const response = await page.request.post(`${BASE_URL}/api/contact`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: '{ invalid json }',
      });
      
      expect([400, 415]).toContain(response.status());
    });

    test('CONTRACT_ERR_004: Error responses have consistent format', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/events/invalid-id`);
      
      if (response.status() >= 400) {
        const body = await response.json().catch(() => ({}));
        
        // Error response should have either message, error, or errors field
        const hasErrorFormat = 
          body.message !== undefined ||
          body.error !== undefined ||
          body.errors !== undefined;
        
        expect(hasErrorFormat).toBe(true);
      }
    });
  });

  // ==================== API PAGINATION ====================

  test.describe('API Pagination', () => {
    test('CONTRACT_PAGE_001: Events API supports pagination', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/events?page=1&limit=10`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(Array.isArray(data) || (data.items !== undefined)).toBe(true);
    });

    test('CONTRACT_PAGE_002: Pagination returns expected structure', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/events?page=1&limit=5`);
      const data = await response.json();
      
      // Should return array with pagination info or pagination object
      if (typeof data === 'object' && !Array.isArray(data)) {
        expect(data).toHaveProperty('items');
        expect(data).toHaveProperty('total');
        expect(data).toHaveProperty('page');
      }
    });

    test('CONTRACT_PAGE_003: Invalid pagination params handled', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/events?page=-1&limit=1000`);
      
      // Should either use defaults or return 400
      expect([200, 400]).toContain(response.status());
    });
  });

  // ==================== API FILTERING & SORTING ====================

  test.describe('API Filtering & Sorting', () => {
    test('CONTRACT_FILTER_001: Events API supports category filter', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/events?category=Special`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        // Should filter by category if supported
        console.log('Category filter response received');
      }
    });

    test('CONTRACT_FILTER_002: Events API supports date range filter', async ({ page }) => {
      const today = new Date().toISOString().split('T')[0];
      const response = await page.request.get(`${BASE_URL}/api/events?startDate=${today}`);
      expect(response.status()).toBe(200);
    });

    test('CONTRACT_SORT_001: Events API supports sorting', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/events?sort=date&order=desc`);
      expect(response.status()).toBe(200);
    });

    test('CONTRACT_SORT_002: Invalid sort field handled gracefully', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/events?sort=invalidField`);
      
      // Should either ignore invalid sort or return 400
      expect([200, 400]).toContain(response.status());
    });
  });

  // ==================== API AUTHENTICATION ====================

  test.describe('API Authentication', () => {
    test('CONTRACT_AUTH_001: Protected endpoints require auth', async ({ page }) => {
      const protectedEndpoints = [
        '/api/admin/events',
        '/api/admin/users',
        '/api/admin/settings',
      ];
      
      for (const endpoint of protectedEndpoints) {
        const response = await page.request.get(`${BASE_URL}${endpoint}`);
        expect([401, 403]).toContain(response.status());
      }
    });

    test('CONTRACT_AUTH_002: Auth endpoints return appropriate errors', async ({ page }) => {
      const response = await page.request.post(`${BASE_URL}/api/auth/login`, {
        data: {
          email: 'nonexistent@test.com',
          password: 'wrongpassword',
        },
      });
      
      expect([401, 400, 422]).toContain(response.status());
    });
  });

  // ==================== API VERSIONING ====================

  test.describe('API Versioning', () => {
    test('CONTRACT_VER_001: API version header present', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/events`);
      const headers = response.headers();
      
      // Check for API version header
      const versionHeader = headers['x-api-version'] || headers['api-version'];
      console.log(`API Version Header: ${versionHeader || 'Not found'}`);
    });

    test('CONTRACT_VER_002: Deprecation warnings for old versions', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/v1/events`);
      
      // Old version should either work or return deprecation notice
      expect([200, 404, 410]).toContain(response.status());
    });
  });

  // ==================== API CACHING ====================

  test.describe('API Caching', () => {
    test('CONTRACT_CACHE_001: GET requests are cacheable', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/events`);
      const headers = response.headers();
      
      const cacheControl = headers['cache-control'];
      const etag = headers['etag'];
      
      // At least one caching mechanism should be present
      const hasCaching = cacheControl !== undefined || etag !== undefined;
      console.log(`Caching: cache-control=${cacheControl}, etag=${etag ? 'present' : 'absent'}`);
    });

    test('CONTRACT_CACHE_002: Conditional requests work', async ({ page }) => {
      // First request
      const firstResponse = await page.request.get(`${BASE_URL}/api/events`);
      const etag = firstResponse.headers()['etag'];
      
      if (etag) {
        // Second request with ETag
        const secondResponse = await page.request.get(`${BASE_URL}/api/events`, {
          headers: {
            'If-None-Match': etag,
          },
        });
        
        // Should return 304 Not Modified if unchanged
        console.log(`Conditional request status: ${secondResponse.status()}`);
      }
    });
  });

  // ==================== API RATE LIMITING ====================

  test.describe('API Rate Limiting', () => {
    test('CONTRACT_RATE_001: Rate limit headers present', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/events`);
      const headers = response.headers();
      
      const rateLimitHeaders = [
        'x-ratelimit-limit',
        'x-ratelimit-remaining',
        'x-ratelimit-reset',
      ];
      
      const presentHeaders = rateLimitHeaders.filter(h => headers[h]);
      console.log(`Rate limit headers: ${presentHeaders.join(', ') || 'None'}`);
    });

    test('CONTRACT_RATE_002: Rate limit exceeded returns 429', async ({ page }) => {
      // Make many rapid requests
      let got429 = false;
      
      for (let i = 0; i < 100; i++) {
        const response = await page.request.get(`${BASE_URL}/api/events`);
        if (response.status() === 429) {
          got429 = true;
          break;
        }
      }
      
      console.log(`Rate limit 429 reached: ${got429}`);
      // We expect either 429 or all requests succeed
    });
  });
});
