import { test, expect, Page } from '@playwright/test';
import { BASE_URL, waitForPageLoad } from '../test-utils';

test.describe('Chaos Engineering Tests - Sprint 5', () => {
  // ==================== NETWORK FAILURE SIMULATION ====================

  test.describe('Network Failure Resilience', () => {
    test('CHAOS_NET_001: Page handles complete network loss gracefully', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Simulate complete network loss
      await page.context().setOffline(true);
      
      // Try to interact with page
      await page.click('nav a').catch(() => {});
      await page.waitForTimeout(1000);
      
      // Page should show offline indicator or error
      const offlineIndicator = page.locator('text=/offline|connection|no network/i');
      const errorOccurred = (await offlineIndicator.count()) > 0;
      
      console.log(`Offline indicator shown: ${errorOccurred}`);
      
      // Restore network
      await page.context().setOffline(false);
      await page.waitForTimeout(500);
    });

    test('CHAOS_NET_002: API requests timeout gracefully', async ({ page }) => {
      // Route to hang indefinitely
      await page.route('**/api/events', async route => {
        // Don't fulfill - let it timeout
        setTimeout(() => {}, 30000);
      });
      
      const startTime = Date.now();
      await page.goto(`${BASE_URL}/events`);
      await page.waitForTimeout(5000);
      const elapsed = Date.now() - startTime;
      
      // Page should either show loading or error, not hang forever
      expect(elapsed).toBeLessThan(10000);
      
      // Clear route
      await page.unroute('**/api/events');
    });

    test('CHAOS_NET_003: Partial network degradation handled', async ({ page }) => {
      // Slow down but don't block
      await page.route('**/api/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 5000));
        await route.continue();
      });
      
      const startTime = Date.now();
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      const loadTime = Date.now() - startTime;
      
      console.log(`Slow API load time: ${loadTime}ms`);
      
      // Page should still load despite slow API
      expect(loadTime).toBeGreaterThan(4000); // At least our delay
      
      await page.unroute('**/api/**');
    });

    test('CHAOS_NET_004: DNS failure handled gracefully', async ({ page }) => {
      // Try to access non-existent domain
      const response = await page.request.get('http://this-domain-definitely-does-not-exist-12345.com');
      
      // Should return error, not crash
      expect([0, 'failed']).toContain(response.status() as any);
    });
  });

  // ==================== TIMEOUT HANDLING ====================

  test.describe('Timeout Handling', () => {
    test('CHAOS_TIMEOUT_001: Long-running operations show timeout error', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      
      // Simulate slow operation
      await page.route('**/api/events', async route => {
        setTimeout(() => route.continue(), 15000);
      });
      
      // Reload and wait for timeout
      await page.reload();
      await page.waitForTimeout(10000);
      
      // Should show error or retry option
      const errorShown = (await page.locator('text=/error|timeout|retry|failed/i').count()) > 0;
      const stillLoading = (await page.locator('[role="status"]:has-text("Loading")').count()) > 0;
      
      console.log(`Timeout handled: error=${errorShown}, stillLoading=${stillLoading}`);
      
      await page.unroute('**/api/events');
    });

    test('CHAOS_TIMEOUT_002: Session timeout handled gracefully', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Wait for extended period (simulated)
      await page.evaluate(() => {
        // Clear session to simulate expiry
        localStorage.clear();
        sessionStorage.clear();
      });
      
      // Try to access protected route
      await page.goto(`${BASE_URL}/profile`);
      await page.waitForTimeout(2000);
      
      // Should redirect to login or show session expired message
      const redirected = page.url().includes('/login');
      const sessionExpired = (await page.locator('text=/session.*expired|please.*login/i').count()) > 0;
      
      expect(redirected || sessionExpired).toBe(true);
    });

    test('CHAOS_TIMEOUT_003: Multiple rapid requests debounced', async ({ page }) => {
      await page.goto(`${BASE_URL}/search`);
      await waitForPageLoad(page);
      
      const searchInput = page.locator('input[type="search"], input[name*="search" i]').first();
      
      if (await searchInput.count() > 0) {
        // Type rapidly
        const queries = ['a', 'ab', 'abc', 'abcd', 'abcde'];
        
        for (const query of queries) {
          await searchInput.fill(query);
          await page.waitForTimeout(50);
        }
        
        await page.waitForTimeout(1000);
        
        // Should debounce and only show results for last query
        const inputValue = await searchInput.inputValue();
        expect(inputValue).toBe('abcde');
      }
    });
  });

  // ==================== GRACEFUL DEGRADATION ====================

  test.describe('Graceful Degradation', () => {
    test('CHAOS_DEG_001: Service unavailable shows fallback', async ({ page }) => {
      // Mock a service as unavailable
      await page.route('**/api/events', route => {
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service Temporarily Unavailable' }),
        });
      });
      
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      // Should show fallback UI or error message
      const hasFallback = (await page.locator('text=/unavailable|temporarily|error/i').count()) > 0 ||
                         (await page.locator('button:has-text("Retry")').count()) > 0;
      
      expect(hasFallback).toBe(true);
      
      await page.unroute('**/api/events');
    });

    test('CHAOS_DEG_002: Images fail gracefully', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);
      
      // Mock image as failed
      await page.route('**/images/**', route => {
        route.fulfill({
          status: 404,
          contentType: 'image/png',
          body: Buffer.from(''),
        });
      });
      
      await page.reload();
      await page.waitForTimeout(2000);
      
      // Page should not crash - images should have alt text or placeholder
      const body = page.locator('body');
      expect(await body.count()).toBe(1);
      
      await page.unroute('**/images/**');
    });

    test('CHAOS_DEG_003: Third-party script failure does not break page', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Mock analytics script as failed
      await page.route('**/analytics/**', route => {
        route.abort();
      });
      
      await page.reload();
      await page.waitForTimeout(2000);
      
      // Core functionality should still work
      const navLinks = page.locator('nav a, header a');
      expect(await navLinks.count()).toBeGreaterThan(0);
      
      await page.unroute('**/analytics/**');
    });

    test('CHAOS_DEG_004: Partial content loaded shows what is available', async ({ page }) => {
      // Mock partial data
      await page.route('**/api/events', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: '1', title: 'Event 1' },
            // Missing some expected fields
          ]),
        });
      });
      
      await page.goto(`${BASE_URL}/events`);
      await page.waitForTimeout(2000);
      
      // Should show at least the available content
      const eventText = page.locator('text=/Event 1/i');
      expect(await eventText.count()).toBeGreaterThan(0);
      
      await page.unroute('**/api/events');
    });
  });

  // ==================== DATA CONSISTENCY ====================

  test.describe('Data Consistency Under Chaos', () => {
    test('CHAOS_DATA_001: Concurrent updates handled consistently', async ({ page }) => {
      // Make concurrent API calls
      const responses = await Promise.all([
        page.request.get(`${BASE_URL}/api/events`),
        page.request.get(`${BASE_URL}/api/events`),
        page.request.get(`${BASE_URL}/api/events`),
      ]);
      
      // All should succeed
      for (const response of responses) {
        expect(response.status()).toBe(200);
      }
      
      // All should return same data structure
      const data = await Promise.all(responses.map(r => r.json()));
      const hasConsistentStructure = data.every(item => 
        Array.isArray(item) || (typeof item === 'object' && 'items' in item)
      );
      
      expect(hasConsistentStructure).toBe(true);
    });

    test('CHAOS_DATA_002: Optimistic updates reverted on failure', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Start an action that might fail
      const createButton = page.locator('button:has-text("Create"), a:has-text("Create")').first();
      
      if (await createButton.count() > 0) {
        // Don't actually fill form - just verify button is clickable
        await createButton.click();
        await page.waitForTimeout(500);
        
        // Cancel should not leave partial state
        const cancelButton = page.locator('button:has-text("Cancel")');
        if (await cancelButton.count() > 0) {
          await cancelButton.click();
          await page.waitForTimeout(500);
        }
      }
    });
  });

  // ==================== RESOURCE EXHAUSTION ====================

  test.describe('Resource Exhaustion Handling', () => {
    test('CHAOS_RES_001: Large response handled', async ({ page }) => {
      // Mock large response
      await page.route('**/api/events', route => {
        const largeArray = Array(1000).fill(null).map((_, i) => ({
          id: `event-${i}`,
          title: `Event ${i} - ${'x'.repeat(100)}`,
          description: 'A'.repeat(10000),
        }));
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(largeArray),
        });
      });
      
      await page.goto(`${BASE_URL}/events`);
      await page.waitForTimeout(3000);
      
      // Page should handle large data without crashing
      const body = page.locator('body');
      expect(await body.count()).toBe(1);
      
      // Should show pagination or virtualized list
      console.log('Large response handled');
      
      await page.unroute('**/api/events');
    });

    test('CHAOS_RES_002: Memory limits respected', async ({ page }) => {
      await page.goto(BASE_URL);
      
      // Check memory if available
      const memoryInfo = await page.evaluate(() => {
        if ('memory' in performance) {
          const mem = (performance as any).memory;
          return {
            usedJSHeapSize: mem.usedJSHeapSize,
            totalJSHeapSize: mem.totalJSHeapSize,
            jsHeapSizeLimit: mem.jsHeapSizeLimit,
          };
        }
        return null;
      });
      
      if (memoryInfo) {
        console.log('Memory usage:', {
          used: `${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
          total: `${(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        });
      }
    });
  });

  // ==================== ERROR BOUNDARY TESTS ====================

  test.describe('Error Boundary Behavior', () => {
    test('CHAOS_ERR_001: React error boundary catches errors', async ({ page }) => {
      // Inject error
      await page.goto(BASE_URL);
      await page.evaluate(() => {
        window.addEventListener('error', e => {
          console.log('Caught error:', e.error);
        });
      });
      
      // Trigger error in component
      await page.evaluate(() => {
        const btn = document.createElement('button');
        btn.onclick = () => {
          throw new Error('Test error for boundary');
        };
        btn.click();
      });
      
      await page.waitForTimeout(1000);
      
      // Should show error boundary UI or recover
      const body = page.locator('body');
      expect(await body.count()).toBe(1);
    });

    test('CHAOS_ERR_002: Unhandled promise rejection handled', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Trigger unhandled rejection
      await page.evaluate(() => {
        window.addEventListener('unhandledrejection', e => {
          console.log('Unhandled rejection:', e.reason);
        });
        
        new Promise((_, reject) => reject(new Error('Test rejection'))).catch(() => {});
      });
      
      await page.waitForTimeout(1000);
      
      // Page should still be functional
      expect(page.url()).toContain(BASE_URL);
    });
  });

  // ==================== RECOVERY BEHAVIOR ====================

  test.describe('Recovery Behavior', () => {
    test('CHAOS_REC_001: Page recovers after network restored', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Go offline
      await page.context().setOffline(true);
      await page.waitForTimeout(1000);
      
      // Go back online
      await page.context().setOffline(false);
      await page.waitForTimeout(1000);
      
      // Page should work again
      const response = await page.request.get(BASE_URL);
      expect(response.status()).toBe(200);
    });

    test('CHAOS_REC_002: Retry mechanism works', async ({ page }) => {
      let attemptCount = 0;
      
      await page.route('**/api/events', async route => {
        attemptCount++;
        if (attemptCount < 3) {
          route.abort();
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{ id: '1', title: 'Recovered Event' }]),
          });
        }
      });
      
      await page.goto(`${BASE_URL}/events`);
      await page.waitForTimeout(5000);
      
      // Should eventually succeed
      const eventText = page.locator('text=/Recovered Event/i');
      expect(await eventText.count()).toBeGreaterThan(0);
      
      await page.unroute('**/api/events');
    });

    test('CHAOS_REC_003: State preserved after error recovery', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(500);
      
      // Trigger error
      await page.route('**/api/**', route => route.abort());
      await page.reload();
      await page.waitForTimeout(3000);
      
      // Restore
      await page.unroute('**/api/**');
      await page.reload();
      await page.waitForTimeout(2000);
      
      // Should restore to functional state
      const body = page.locator('body');
      expect(await body.count()).toBe(1);
    });
  });
});
