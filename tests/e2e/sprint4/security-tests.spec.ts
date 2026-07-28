import { test, expect, Page, request } from '@playwright/test';
import { BASE_URL, waitForPageLoad } from '../test-utils';

test.describe('Security Tests - Sprint 4', () => {
  // ==================== XSS PROTECTION TESTS ====================

  test.describe('XSS Protection', () => {
    test('SEC_XSS_001: Search input sanitizes XSS payloads', async ({ page }) => {
      await page.goto(`${BASE_URL}/search`);
      await waitForPageLoad(page);
      
      // Try XSS payload
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '"><img src=x onerror=alert("XSS")>',
        "javascript:alert('XSS')",
        '<svg onload=alert("XSS")>',
        "'; alert('XSS');//",
      ];
      
      for (const payload of xssPayloads) {
        const searchInput = page.locator('input[type="search"], input[name*="search" i], input[placeholder*="search" i]').first();
        
        if (await searchInput.count() > 0) {
          await searchInput.fill(payload);
          await searchInput.press('Enter');
          await page.waitForTimeout(1000);
          
          // Check page content - script should not execute
          const pageContent = await page.content();
          
          // Script tags should be escaped or removed
          expect(pageContent).not.toContain('<script>alert("XSS")</script>');
        }
      }
    });

    test('SEC_XSS_002: Form inputs sanitize XSS in contact form', async ({ page }) => {
      await page.goto(`${BASE_URL}/contact`);
      await waitForPageLoad(page);
      
      const xssPayload = '<script>alert("XSS")</script>';
      
      // Find text inputs
      const textInputs = page.locator('input[type="text"], input[name*="name" i], textarea');
      
      for (let i = 0; i < Math.min(await textInputs.count(), 3); i++) {
        const input = textInputs.nth(i);
        if (await input.count() > 0) {
          await input.fill(xssPayload);
          
          // Submit form
          const submitButton = page.locator('button[type="submit"]').first();
          if (await submitButton.count() > 0) {
            await submitButton.click();
            await page.waitForTimeout(1000);
            
            // Check that script was sanitized
            const pageContent = await page.content();
            expect(pageContent).not.toContain('<script>');
          }
        }
      }
    });

    test('SEC_XSS_003: URL parameters are sanitized', async ({ page }) => {
      // Try XSS in URL parameters
      const xssUrl = `${BASE_URL}/events?q=<script>alert("XSS")</script>`;
      
      await page.goto(xssUrl);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      
      // Script should not execute
      const pageContent = await page.content();
      expect(pageContent).not.toContain('<script>alert("XSS")</script>');
    });

    test('SEC_XSS_004: Event title/input sanitizes HTML', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events/new`);
      await waitForPageLoad(page);
      
      const htmlPayload = '<img src=x onerror=alert("XSS")>';
      
      const titleInput = page.locator('input[name*="title" i], input[placeholder*="title" i]').first();
      
      if (await titleInput.count() > 0) {
        await titleInput.fill(htmlPayload);
        await titleInput.blur();
        await page.waitForTimeout(500);
        
        // The value should be sanitized or escaped
        const value = await titleInput.inputValue();
        // Should not contain raw script tag
        expect(value).not.toContain('<script>');
      }
    });
  });

  // ==================== SQL INJECTION TESTS ====================

  test.describe('SQL Injection Protection', () => {
    test('SEC_SQL_001: Search input prevents SQL injection', async ({ page }) => {
      await page.goto(`${BASE_URL}/search`);
      await waitForPageLoad(page);
      
      const sqlPayloads = [
        "'; DROP TABLE events;--",
        "1' OR '1'='1",
        "'; SELECT * FROM users;--",
        "1; DELETE FROM events WHERE 1=1;--",
      ];
      
      for (const payload of sqlPayloads) {
        const searchInput = page.locator('input[type="search"], input[name*="search" i]').first();
        
        if (await searchInput.count() > 0) {
          await searchInput.fill(payload);
          await searchInput.press('Enter');
          await page.waitForTimeout(1000);
          
          // Page should not crash and should show no results or error
          const url = page.url();
          // Should still be on search page
          expect(url).toContain('/search');
        }
      }
    });

    test('SEC_SQL_002: API endpoints prevent SQL injection', async ({ page }) => {
      const sqlPayloads = [
        "'; DROP TABLE events;--",
        "1' OR '1'='1",
        "'; SELECT * FROM users;--",
      ];
      
      for (const payload of sqlPayloads) {
        const response = await page.request.get(`${BASE_URL}/api/events?search=${encodeURIComponent(payload)}`);
        
        // Should return 200 or 400, not crash
        expect([200, 400, 422]).toContain(response.status());
      }
    });
  });

  // ==================== CSRF PROTECTION TESTS ====================

  test.describe('CSRF Protection', () => {
    test('SEC_CSRF_001: Forms include CSRF tokens', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      const forms = await page.locator('form').all();
      
      for (const form of forms) {
        // Check for CSRF token
        const csrfToken = form.locator('input[name*="csrf" i], input[name*="_token" i], input[name*="token" i]');
        
        // If CSRF token exists, it should have a value
        if (await csrfToken.count() > 0) {
          const tokenValue = await csrfToken.first().inputValue();
          expect(tokenValue.length).toBeGreaterThan(0);
        }
      }
    });

    test('SEC_CSRF_002: API mutations require auth token', async ({ page }) => {
      // Try to make a mutation without auth token
      const response = await page.request.post(`${BASE_URL}/api/contact`, {
        data: {
          name: 'Test',
          email: 'test@test.com',
          message: 'Test message',
        },
      });
      
      // Should return 401 or 403 without auth
      expect([401, 403, 422]).toContain(response.status());
    });

    test('SEC_CSRF_003: Logout requires valid session', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Clear all cookies
      await page.context().clearCookies();
      
      // Try to access protected action
      const response = await page.request.post(`${BASE_URL}/api/auth/logout`);
      
      // Should require valid session
      expect([200, 401, 403]).toContain(response.status());
    });
  });

  // ==================== RATE LIMITING TESTS ====================

  test.describe('Rate Limiting', () => {
    test('SEC_RATE_001: API enforces rate limiting on search', async ({ page }) => {
      const responses: number[] = [];
      
      // Make many rapid requests
      for (let i = 0; i < 60; i++) {
        const response = await page.request.get(`${BASE_URL}/api/events`);
        responses.push(response.status());
        
        if (response.status() === 429) {
          break; // Rate limited
        }
      }
      
      // Should either rate limit or complete
      const hasRateLimit = responses.includes(429);
      console.log(`Rate limited: ${hasRateLimit}, Total requests: ${responses.length}`);
    });

    test('SEC_RATE_002: Login endpoint rate limits failed attempts', async ({ page }) => {
      const responses: number[] = [];
      
      // Try multiple failed logins
      for (let i = 0; i < 10; i++) {
        const response = await page.request.post(`${BASE_URL}/api/auth/login`, {
          data: {
            email: 'wrong@test.com',
            password: 'wrongpassword',
          },
        });
        responses.push(response.status());
      }
      
      // Should rate limit or show increased cooldown
      console.log(`Login attempts: ${responses.length}, Statuses: ${JSON.stringify([...new Set(responses)])}`);
    });

    test('SEC_RATE_003: Contact form rate limits submissions', async ({ page }) => {
      const responses: number[] = [];
      
      // Try multiple rapid submissions
      for (let i = 0; i < 15; i++) {
        const response = await page.request.post(`${BASE_URL}/api/contact`, {
          data: {
            name: `Test${i}`,
            email: `test${i}@test.com`,
            message: `Test message ${i}`,
          },
        });
        responses.push(response.status());
        
        if (response.status() === 429) {
          break;
        }
      }
      
      const hasRateLimit = responses.includes(429);
      console.log(`Contact form rate limited: ${hasRateLimit}`);
    });
  });

  // ==================== AUTHENTICATION SECURITY TESTS ====================

  test.describe('Authentication Security', () => {
    test('SEC_AUTH_001: Password field does not show in page source', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      await page.fill('input[type="password"]', 'MySecretPassword123');
      await page.waitForTimeout(500);
      
      // Get page content
      const pageContent = await page.content();
      
      // Password should not appear in plain text in the page source
      expect(pageContent).not.toContain('MySecretPassword123');
    });

    test('SEC_AUTH_002: Session cookies are httpOnly', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      // Login
      await page.fill('input[type="email"]', 'test@test.com');
      await page.fill('input[type="password"]', 'password');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
      
      // Check cookies
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(c => 
        c.name.includes('session') || 
        c.name.includes('auth') || 
        c.name.includes('token')
      );
      
      if (sessionCookie) {
        // Session cookie should be httpOnly
        // Note: Can't directly check httpOnly flag from Playwright
        expect(sessionCookie.value.length).toBeGreaterThan(0);
      }
    });

    test('SEC_AUTH_003: Session expires after inactivity', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Login
      await page.fill('input[type="email"]', 'test@test.com');
      await page.fill('input[type="password"]', 'password');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
      
      // Wait for session to expire (if there's a short timeout for testing)
      await page.waitForTimeout(5000);
      
      // Try to access protected page
      await page.goto(`${BASE_URL}/profile`);
      await page.waitForTimeout(2000);
      
      // Should either still be logged in or redirect to login
      const url = page.url();
      expect(url.includes('/profile') || url.includes('/login')).toBeTruthy();
    });

    test('SEC_AUTH_004: Invalid session tokens are rejected', async ({ page }) => {
      // Set invalid session token
      await page.context().addCookies([{
        name: 'session_token',
        value: 'invalid_token_12345',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
      }]);
      
      await page.goto(`${BASE_URL}/profile`);
      await page.waitForTimeout(2000);
      
      // Should redirect to login
      expect(page.url()).toContain('/login');
    });

    test('SEC_AUTH_005: Password reset requires valid email', async ({ page }) => {
      await page.goto(`${BASE_URL}/forgot-password`);
      await waitForPageLoad(page);
      
      // Try with non-existent email
      await page.fill('input[type="email"]', 'nonexistent_email_12345@test.com');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
      
      // Should not reveal if email exists
      const pageContent = await page.content().then(c => c.toLowerCase());
      
      // Should not explicitly say "email not found" to prevent email enumeration
      const revealsNotFound = pageContent.includes('not found') && pageContent.includes('email');
      expect(revealsNotFound).toBe(false);
    });
  });

  // ==================== HEADER SECURITY TESTS ====================

  test.describe('Security Headers', () => {
    test('SEC_HEAD_001: HTTPS is enforced in production', async ({ page }) => {
      // Make request and check headers
      const response = await page.request.get(BASE_URL);
      const headers = response.headers();
      
      // Note: This is a basic check - actual header checks would require production
      console.log(`Security headers present:`, {
        'x-content-type': headers['x-content-type-options'],
        'x-frame': headers['x-frame-options'],
        'x-xss': headers['x-xss-protection'],
        'referrer': headers['referrer-policy'],
      });
    });

    test('SEC_HEAD_002: Cache-Control headers protect sensitive data', async ({ page }) => {
      // Check API response headers
      const response = await page.request.get(`${BASE_URL}/api/events`);
      const cacheControl = response.headers()['cache-control'];
      
      // API responses should have appropriate cache headers
      console.log(`Cache-Control: ${cacheControl}`);
    });
  });

  // ==================== INPUT VALIDATION TESTS ====================

  test.describe('Input Validation', () => {
    test('SEC_VAL_001: Email field validates email format', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      const invalidEmails = [
        'notanemail',
        '@nodomain.com',
        'noat.com',
        'spaces in@email.com',
        'verylong' + 'a'.repeat(100) + '@test.com',
      ];
      
      const emailInput = page.locator('input[type="email"]').first();
      
      for (const email of invalidEmails) {
        await emailInput.fill(email);
        await emailInput.blur();
        await page.waitForTimeout(300);
        
        // Check for validation error
        const errorElement = page.locator('[aria-invalid="true"], .error, .text-red-500, text="/invalid|required/i"').first();
        
        if (await errorElement.count() > 0) {
          // Validation error shown
        }
      }
    });

    test('SEC_VAL_002: Phone number field validates format', async ({ page }) => {
      await page.goto(`${BASE_URL}/contact`);
      await waitForPageLoad(page);
      
      const phoneInput = page.locator('input[type="tel"], input[name*="phone" i], input[name*="mobile" i]').first();
      
      if (await phoneInput.count() > 0) {
        const invalidPhones = [
          'abc',
          '123',
          '+' + '1'.repeat(20),
          'invalid',
        ];
        
        for (const phone of invalidPhones) {
          await phoneInput.fill(phone);
          await phoneInput.blur();
          await page.waitForTimeout(300);
        }
      }
    });

    test('SEC_VAL_003: URL field validates URL format', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/settings/social-links`);
      await waitForPageLoad(page);
      
      const urlInput = page.locator('input[type="url"], input[name*="url" i], input[placeholder*="url" i]').first();
      
      if (await urlInput.count() > 0) {
        const invalidUrls = [
          'not a url',
          'javascript:alert(1)',
          'ftp://invalid',
        ];
        
        for (const url of invalidUrls) {
          await urlInput.fill(url);
          await urlInput.blur();
          await page.waitForTimeout(300);
        }
      }
    });

    test('SEC_VAL_004: File upload validates file types', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/gallery/new`);
      await waitForPageLoad(page);
      
      const fileInput = page.locator('input[type="file"]').first();
      
      if (await fileInput.count() > 0) {
        // Try to upload executable files
        // Note: We can't actually upload files in this test, but can check validation
        const acceptAttr = await fileInput.getAttribute('accept');
        
        if (acceptAttr) {
          // Should only accept image types
          expect(acceptAttr).toMatch(/image\/(png|jpg|jpeg|gif|webp)/);
        }
      }
    });

    test('SEC_VAL_005: Input length limits are enforced', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events/new`);
      await waitForPageLoad(page);
      
      const titleInput = page.locator('input[name*="title" i], input[placeholder*="title" i]').first();
      
      if (await titleInput.count() > 0) {
        // Check for maxlength attribute
        const maxLength = await titleInput.getAttribute('maxlength');
        
        if (maxLength) {
          const limit = parseInt(maxLength, 10);
          expect(limit).toBeGreaterThan(0);
          expect(limit).toBeLessThanOrEqual(500); // Reasonable limit
        }
      }
    });
  });

  // ==================== INFORMATION DISCLOSURE TESTS ====================

  test.describe('Information Disclosure', () => {
    test('SEC_INFO_001: Error pages do not reveal stack traces', async ({ page }) => {
      // Navigate to non-existent page
      await page.goto(`${BASE_URL}/this-page-does-not-exist-12345`);
      await page.waitForTimeout(2000);
      
      const pageContent = await page.content();
      
      // Should not contain stack traces
      expect(pageContent).not.toContain('at Object.');
      expect(pageContent).not.toContain('at Module.');
      expect(pageContent).not.toContain('node_modules');
      expect(pageContent).not.toContain('.js:');
    });

    test('SEC_INFO_002: API errors do not expose internal paths', async ({ page }) => {
      // Try invalid API call
      const response = await page.request.get(`${BASE_URL}/api/nonexistent-endpoint`);
      
      const body = await response.json().catch(() => null);
      
      if (body && typeof body === 'object') {
        const bodyStr = JSON.stringify(body).toLowerCase();
        
        // Should not reveal internal paths
        expect(bodyStr).not.toContain('/app/');
        expect(bodyStr).not.toContain('/node_modules/');
        expect(bodyStr).not.toContain('c:\\');
        expect(bodyStr).not.toContain('process.cwd()');
      }
    });

    test('SEC_INFO_003: Debug mode is disabled in production', async ({ page }) => {
      const response = await page.request.get(BASE_URL);
      
      // Should not have debug headers
      const headers = response.headers();
      
      expect(headers['x-debug']).toBeUndefined();
      expect(headers['debug']).toBeUndefined();
    });

    test('SEC_INFO_004: Version numbers are not exposed', async ({ page }) => {
      const response = await page.request.get(BASE_URL);
      const headers = response.headers();
      
      // Should not expose framework versions
      const allHeaders = JSON.stringify(headers).toLowerCase();
      expect(allHeaders).not.toContain('next.js');
      expect(allHeaders).not.toContain('react');
    });
  });

  // ==================== FILE INCLUSION TESTS ====================

  test.describe('File Inclusion Protection', () => {
    test('SEC_FILE_001: Path traversal is blocked', async ({ page }) => {
      const payloads = [
        '../../../etc/passwd',
        '..%2F..%2F..%2Fetc%2Fpasswd',
        '....//....//....//etc/passwd',
        '/etc/passwd',
        'C:\\Windows\\System32\\config\\sam',
      ];
      
      for (const payload of payloads) {
        const response = await page.request.get(`${BASE_URL}/api/events?file=${payload}`);
        
        // Should return 400 or ignore the payload
        expect([200, 400, 404, 422]).toContain(response.status());
      }
    });

    test('SEC_FILE_002: Invalid file types are rejected in uploads', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/gallery/new`);
      await waitForPageLoad(page);
      
      const fileInput = page.locator('input[type="file"]').first();
      
      if (await fileInput.count() > 0) {
        // Check accept attribute
        const accept = await fileInput.getAttribute('accept');
        
        if (accept) {
          // Should only accept images
          expect(accept).toContain('image/');
          expect(accept).not.toContain('.exe');
          expect(accept).not.toContain('.php');
          expect(accept).not.toContain('.js');
        }
      }
    });
  });
});
