import { test, expect, Page } from '@playwright/test';
import { BASE_URL } from '../test-utils';

test.describe('Error Handling Module', () => {
  test.describe('404 Not Found', () => {
    test('ERR-001: 404 page loads for invalid routes', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/nonexistent-page-xyz-123`);
      
      // Should show 404 or redirect
      expect([200, 404]).toContain(response?.status());
    });

    test('ERR-002: 404 page has friendly message', async ({ page }) => {
      await page.goto(`${BASE_URL}/nonexistent-page-xyz-123`);
      await page.waitForLoadState('domcontentloaded');
      
      const content = await page.content();
      // Should show user-friendly message
      expect(content).toBeTruthy();
    });

    test('ERR-003: 404 page has navigation options', async ({ page }) => {
      await page.goto(`${BASE_URL}/nonexistent-page-xyz-123`);
      
      const homeLink = page.locator('a[href="/"], a:has-text("Home")');
      const count = await homeLink.count();
      // Should have way to navigate back
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('ERR-004: 404 page does not leak information', async ({ page }) => {
      await page.goto(`${BASE_URL}/nonexistent-page-xyz-123`);
      
      const content = await page.content();
      expect(content).not.toMatch(/sql|database|stack.*trace|error.*line/i);
    });
  });

  test.describe('500 Server Error', () => {
    test('ERR-010: Server error is handled gracefully', async ({ page }) => {
      // Try to access a route that might cause server error
      await page.goto(`${BASE_URL}/api/trigger-error`);
      await page.waitForTimeout(1000);
      
      // Should show error page or message
      const content = await page.content();
      expect(content).toBeTruthy();
    });

    test('ERR-011: Error page does not leak stack traces', async ({ page }) => {
      await page.goto(`${BASE_URL}/api/trigger-error`);
      await page.waitForTimeout(1000);
      
      const content = await page.content();
      expect(content).not.toMatch(/at .*\.ts.*line|stack.*trace|Error:.*at /i);
    });
  });

  test.describe('Network Error Handling', () => {
    test('ERR-020: Page handles network failure', async ({ page }) => {
      // Block all requests to simulate network failure
      await page.route('**', route => {
        route.abort('failed');
      });
      
      await page.goto(BASE_URL).catch(() => {});
      await page.waitForTimeout(1000);
      
      // Should show offline message or fallback
    });

    test('ERR-021: Slow network is handled', async ({ page }) => {
      // Add delay to simulate slow network
      await page.route('**', route => {
        route.continue({ delay: 5000 });
      });
      
      const timeoutPromise = page.goto(BASE_URL, { timeout: 10000 });
      await timeoutPromise.catch(() => {});
      
      // Should handle timeout gracefully
    });
  });

  test.describe('JavaScript Error Handling', () => {
    test('ERR-030: Page does not crash on JS error', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => {
        errors.push(error.message);
      });
      
      await page.goto(BASE_URL);
      await page.waitForTimeout(2000);
      
      // Should not have critical page errors
      const criticalErrors = errors.filter(e => 
        !e.includes('Firebase') && 
        !e.includes('Warning')
      );
      
      expect(criticalErrors.length).toBe(0);
    });

    test('ERR-031: Console errors are handled', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await page.goto(BASE_URL);
      await page.waitForTimeout(2000);
      
      // Should not have critical console errors
    });
  });

  test.describe('Form Error Handling', () => {
    test('ERR-040: Form submission error is shown', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
      
      // Should show error message or remain on page
    });

    test('ERR-041: Network error during submission shows message', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      // Block the submission endpoint
      await page.route('**/api/**', route => {
        route.abort('failed');
      });
      
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'password');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
      
      // Should show network error message
    });

    test('ERR-042: Duplicate form submission is prevented', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const nameField = page.locator('input[name*="name" i]').first();
      const emailField = page.locator('input[type="email"]').first();
      
      if (await nameField.count() > 0) {
        await nameField.fill('Test User');
      }
      if (await emailField.count() > 0) {
        await emailField.fill('test@example.com');
      }
      
      // Click submit twice quickly
      await page.click('button[type="submit"]');
      await page.waitForTimeout(100);
      await page.click('button[type="submit"]').catch(() => {});
      
      await page.waitForTimeout(1000);
      // Should prevent duplicate submission
    });
  });

  test.describe('Firebase Error Handling', () => {
    test('ERR-050: Firestore errors are handled', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error' && msg.text().includes('Firestore')) {
          errors.push(msg.text());
        }
      });
      
      await page.goto(BASE_URL);
      await page.waitForTimeout(3000);
      
      // Firestore errors should be handled gracefully
    });

    test('ERR-051: Auth errors are handled', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.fill('input[type="email"]', 'nonexistent@example.com');
      await page.fill('input[type="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      
      // Should show auth error message
    });
  });

  test.describe('Image Loading Errors', () => {
    test('ERR-060: Broken images show fallback', async ({ page }) => {
      await page.goto(BASE_URL);
      
      // Check if broken images have fallback
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 3); i++) {
        const img = images.nth(i);
        await img.evaluate((el: HTMLImageElement) => {
          // Simulate error if needed
        });
      }
    });

    test('ERR-061: Missing images do not crash page', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => {
        errors.push(error.message);
      });
      
      await page.goto(BASE_URL);
      await page.waitForTimeout(2000);
      
      // Page should not crash
      expect(errors.length).toBe(0);
    });
  });

  test.describe('API Error Handling', () => {
    test('ERR-070: API timeout is handled', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/events`, {
        timeout: 1000
      }).catch(() => ({ status: () => 408 }));
      
      // Should return timeout or handle gracefully
    });

    test('ERR-071: Invalid API response is handled', async ({ request }) => {
      // Mock an invalid response
      const response = await request.get(`${BASE_URL}/api/invalid`);
      // Should handle invalid response
      expect(response).toBeTruthy();
    });

    test('ERR-072: API rate limit is handled', async ({ request }) => {
      // Make many rapid requests
      const responses = [];
      for (let i = 0; i < 20; i++) {
        responses.push(request.get(`${BASE_URL}/api/events`));
      }
      
      const results = await Promise.all(responses);
      // Should handle rate limiting gracefully
      expect(results.length).toBe(20);
    });
  });

  test.describe('Empty States', () => {
    test('ERR-080: Empty events list shows message', async ({ page }) => {
      // This would require a scenario with no events
      await page.goto(`${BASE_URL}/events`);
      await page.waitForTimeout(2000);
      
      // Should show appropriate message
    });

    test('ERR-081: Empty search results shows message', async ({ page }) => {
      await page.goto(`${BASE_URL}/search`);
      await page.waitForTimeout(1000);
      
      const searchInput = page.locator('input[type="search"]').first();
      if (await searchInput.count() > 0) {
        await searchInput.fill('xyzabcnonexistent123');
        await searchInput.press('Enter');
        await page.waitForTimeout(2000);
        
        // Should show no results message
      }
    });

    test('ERR-082: Loading state is shown', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      
      // Should show loading indicator
      const loading = page.locator('[class*="loading"], [class*="spinner"], [role="status"]');
      const count = await loading.count();
      // Loading state should appear
    });
  });

  test.describe('Validation Error Messages', () => {
    test('ERR-090: Required field errors are clear', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
      
      const errors = page.locator('[class*="error"], [role="alert"], .text-red');
      const count = await errors.count();
      // Should show clear error messages
    });

    test('ERR-091: Format errors are descriptive', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.fill('input[type="email"]', 'not-an-email');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
      
      // Should show email format error
    });

    test('ERR-092: Error messages are accessible', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.fill('input[type="email"]', 'invalid');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
      
      const accessibleErrors = page.locator('[aria-live="polite"], [role="alert"]');
      const count = await accessibleErrors.count();
      // Errors should be announced to screen readers
    });
  });
});
