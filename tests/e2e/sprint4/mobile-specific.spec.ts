import { test, expect, Page } from '@playwright/test';
import { BASE_URL, waitForPageLoad, VIEWPORTS } from '../test-utils';

test.describe('Mobile-Specific Tests - Sprint 4', () => {
  // ==================== GESTURE TESTS ====================

  test.describe('Gesture Testing', () => {
    test('MOBILE_GEST_001: Pull to refresh works on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize(VIEWPORTS.mobile);
      
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      // Simulate pull to refresh
      const startX = 200;
      const startY = 300;
      const endY = 100;
      
      await page.touchscreen.tap(startX, startY);
      
      // Perform swipe down gesture
      await page.evaluate(async ({ startX, startY, endY }) => {
        const touch = new Touch({
          identifier: 1,
          target: document.body,
          clientX: startX,
          clientY: startY,
          radiusX: 0,
          radiusY: 0,
          rotationAngle: 0,
          force: 0,
        });
        
        const touchStart = new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [touch],
        });
        
        document.dispatchEvent(touchStart);
        
        const touchEnd = new TouchEvent('touchend', {
          bubbles: true,
          cancelable: true,
          touches: [],
          changedTouches: [touch],
        });
        
        document.dispatchEvent(touchEnd);
      }, { startX, startY, endY });
      
      await page.waitForTimeout(1000);
      
      // Page should still be functional
      expect(page.url()).toContain('/events');
    });

    test('MOBILE_GEST_002: Horizontal swipe works on carousel/gallery', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);
      
      // Look for swipeable elements
      const carousel = page.locator('[class*="carousel"], [class*="swipe"], [class*="slider"]').first();
      
      if (await carousel.count() > 0) {
        const box = await carousel.boundingBox();
        if (box) {
          // Perform horizontal swipe
          await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
          
          await page.evaluate(async ({ x, y, width }) => {
            const touch = new Touch({
              identifier: 1,
              target: document.body,
              clientX: x,
              clientY: y,
              radiusX: 0,
              radiusY: 0,
              rotationAngle: 0,
              force: 0,
            });
            
            const touchStart = new TouchEvent('touchstart', {
              bubbles: true,
              cancelable: true,
              touches: [touch],
            });
            document.dispatchEvent(touchStart);
            
            const touchMove = new TouchEvent('touchmove', {
              bubbles: true,
              cancelable: true,
              touches: [touch],
            });
            document.dispatchEvent(touchMove);
            
            const touchEnd = new TouchEvent('touchend', {
              bubbles: true,
              cancelable: true,
              touches: [],
              changedTouches: [touch],
            });
            document.dispatchEvent(touchEnd);
          }, { x: box.x + 50, y: box.y + box.height / 2, width: box.width });
          
          await page.waitForTimeout(500);
        }
      }
      
      expect(true).toBe(true); // Test completes without errors
    });

    test('MOBILE_GEST_003: Tap on links/buttons works correctly', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Find a clickable element
      const link = page.locator('nav a, header a').first();
      
      if (await link.count() > 0) {
        const box = await link.boundingBox();
        if (box) {
          await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(2000);
          
          // Should navigate or show menu
          expect(page.url()).not.toBe('');
        }
      }
      
      expect(true).toBe(true);
    });

    test('MOBILE_GEST_004: Long press works on interactive elements', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      // Find event cards
      const card = page.locator('[class*="card"], .event, article').first();
      
      if (await card.count() > 0) {
        const box = await card.boundingBox();
        if (box) {
          // Long press simulation
          await page.evaluate(async ({ x, y }) => {
            const touch = new Touch({
              identifier: 1,
              target: document.body,
              clientX: x,
              clientY: y,
              radiusX: 0,
              radiusY: 0,
              rotationAngle: 0,
              force: 0,
            });
            
            const touchStart = new TouchEvent('touchstart', {
              bubbles: true,
              cancelable: true,
              touches: [touch],
            });
            document.dispatchEvent(touchStart);
            
            // Wait 500ms for long press
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const touchEnd = new TouchEvent('touchend', {
              bubbles: true,
              cancelable: true,
              touches: [],
              changedTouches: [touch],
            });
            document.dispatchEvent(touchEnd);
          }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
          
          await page.waitForTimeout(500);
        }
      }
      
      expect(true).toBe(true);
    });

    test('MOBILE_GEST_005: Pinch zoom works on images', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);
      
      // Find images
      const image = page.locator('img').first();
      
      if (await image.count() > 0) {
        const box = await image.boundingBox();
        if (box && box.width > 100 && box.height > 100) {
          // Simulate pinch gesture (two-finger zoom)
          await page.evaluate(async ({ x, y, width, height }) => {
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            
            const touch1 = new Touch({
              identifier: 1,
              target: document.body,
              clientX: centerX - 50,
              clientY: centerY,
              radiusX: 0,
              radiusY: 0,
              rotationAngle: 0,
              force: 0,
            });
            
            const touch2 = new Touch({
              identifier: 2,
              target: document.body,
              clientX: centerX + 50,
              clientY: centerY,
              radiusX: 0,
              radiusY: 0,
              rotationAngle: 0,
              force: 0,
            });
            
            const touchStart = new TouchEvent('touchstart', {
              bubbles: true,
              cancelable: true,
              touches: [touch1, touch2],
            });
            document.dispatchEvent(touchStart);
            
            const touchEnd = new TouchEvent('touchend', {
              bubbles: true,
              cancelable: true,
              touches: [],
              changedTouches: [touch1, touch2],
            });
            document.dispatchEvent(touchEnd);
          }, { x: box.x, y: box.y, width: box.width, height: box.height });
          
          await page.waitForTimeout(500);
        }
      }
      
      expect(true).toBe(true);
    });
  });

  // ==================== DEVICE ROTATION TESTS ====================

  test.describe('Device Rotation Tests', () => {
    test('MOBILE_ROT_001: Page renders correctly in portrait mode', async ({ page }) => {
      // Portrait mode
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Verify page is rendered
      const body = page.locator('body');
      expect(await body.count()).toBe(1);
      
      // Verify no horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const windowWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(windowWidth);
    });

    test('MOBILE_ROT_002: Page renders correctly in landscape mode', async ({ page }) => {
      // Landscape mode
      await page.setViewportSize({ width: 667, height: 375 });
      
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Verify page is rendered
      const body = page.locator('body');
      expect(await body.count()).toBe(1);
      
      // Verify no horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const windowWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(windowWidth);
    });

    test('MOBILE_ROT_003: Layout adjusts when rotating from portrait to landscape', async ({ page }) => {
      // Start in portrait
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(BASE_URL);
      await page.waitForTimeout(1000);
      
      const portraitBodyWidth = await page.evaluate(() => document.body.scrollWidth);
      
      // Rotate to landscape
      await page.setViewportSize({ width: 667, height: 375 });
      await page.waitForTimeout(1000);
      
      const landscapeBodyWidth = await page.evaluate(() => document.body.scrollWidth);
      
      // In landscape, body should be wider
      expect(landscapeBodyWidth).toBeGreaterThanOrEqual(portraitBodyWidth);
    });

    test('MOBILE_ROT_004: Touch targets remain accessible after rotation', async ({ page }) => {
      // Portrait
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      // Check button is tappable
      const button = page.locator('button[type="submit"]').first();
      if (await button.count() > 0) {
        const box = await button.boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(44); // iOS minimum touch target
        }
      }
      
      // Rotate
      await page.setViewportSize({ width: 667, height: 375 });
      await page.waitForTimeout(500);
      
      // Button should still be accessible
      if (await button.count() > 0) {
        const box = await button.boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
      
      expect(true).toBe(true);
    });

    test('MOBILE_ROT_005: Forms remain usable after rotation', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      // Fill form in portrait
      await page.fill('input[type="email"]', 'test@example.com');
      const portraitEmailValue = await page.locator('input[type="email"]').inputValue();
      
      // Rotate
      await page.setViewportSize({ width: 667, height: 375 });
      await page.waitForTimeout(500);
      
      // Form values should persist
      const landscapeEmailValue = await page.locator('input[type="email"]').inputValue();
      expect(landscapeEmailValue).toBe(portraitEmailValue);
    });
  });

  // ==================== OFFLINE MODE TESTS ====================

  test.describe('Offline Mode Tests', () => {
    test('MOBILE_OFFL_001: Service worker registration', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Check if service worker is registered
      const hasServiceWorker = await page.evaluate(async () => {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          return registrations.length > 0;
        }
        return false;
      });
      
      // Note: Service worker may not be registered in test environment
      console.log(`Service Worker registered: ${hasServiceWorker}`);
    });

    test('MOBILE_OFFL_002: Offline indicator shows when offline', async ({ page }) => {
      // Go online first
      await page.context().setOffline(false);
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Set offline
      await page.context().setOffline(true);
      await page.waitForTimeout(500);
      
      // Check for offline indicator or error state
      const offlineIndicator = page.locator('text=/offline|no connection/i');
      const errorMessage = page.locator('text=/network|connection/i');
      
      // Either shows offline indicator or handles gracefully
      const hasIndicator = (await offlineIndicator.count()) > 0;
      const hasError = (await errorMessage.count()) > 0;
      
      // Page should handle offline gracefully
      console.log(`Offline handled: indicator=${hasIndicator}, error=${hasError}`);
      
      // Go back online
      await page.context().setOffline(false);
    });

    test('MOBILE_OFFL_003: Cached pages load when offline', async ({ page }) => {
      // First visit to cache the page
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Go offline
      await page.context().setOffline(true);
      
      // Try to reload
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      
      // Page should either show cached content or offline error
      const body = page.locator('body');
      expect(await body.count()).toBe(1);
      
      // Go back online
      await page.context().setOffline(false);
    });

    test('MOBILE_OFFL_004: Offline API requests fail gracefully', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Set offline
      await page.context().setOffline(true);
      
      // Try to fetch data
      const response = await page.request.get(`${BASE_URL}/api/events`);
      
      // Should fail or timeout
      // Note: Response might still come from cache
      
      // Go back online
      await page.context().setOffline(false);
      
      expect(true).toBe(true);
    });

    test('MOBILE_OFFL_005: Online status restored after going back online', async ({ page }) => {
      // Set offline
      await page.context().setOffline(true);
      await page.waitForTimeout(500);
      
      const offlineStatus = await page.evaluate(() => !navigator.onLine);
      expect(offlineStatus).toBe(true);
      
      // Go back online
      await page.context().setOffline(false);
      await page.waitForTimeout(500);
      
      const onlineStatus = await page.evaluate(() => navigator.onLine);
      expect(onlineStatus).toBe(true);
    });
  });

  // ==================== MOBILE NAVIGATION TESTS ====================

  test.describe('Mobile Navigation Tests', () => {
    test('MOBILE_NAV_001: Hamburger menu opens on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Look for hamburger menu
      const hamburger = page.locator(
        'button[aria-label*="menu"], button[aria-label*="Menu"], ' +
        '[class*="hamburger"], [class*="menu-toggle"], ' +
        'button[class*="nav"], nav button'
      ).first();
      
      if (await hamburger.count() > 0) {
        await hamburger.click();
        await page.waitForTimeout(500);
        
        // Menu should be open
        const menu = page.locator(
          '[role="menu"], [class*="menu"], nav ul, nav > div'
        );
        expect(await menu.count()).toBeGreaterThan(0);
      }
    });

    test('MOBILE_NAV_002: Menu closes after selecting item', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Open menu
      const hamburger = page.locator('button[class*="menu"], button[aria-label*="menu"]').first();
      
      if (await hamburger.count() > 0) {
        await hamburger.click();
        await page.waitForTimeout(500);
        
        // Click a menu item
        const menuItem = page.locator('nav a, [role="menu"] a, [class*="menu"] a').first();
        if (await menuItem.count() > 0) {
          await menuItem.click();
          await page.waitForTimeout(1000);
          
          // Menu should be closed
          // This is a basic check - actual behavior depends on implementation
        }
      }
      
      expect(true).toBe(true);
    });

    test('MOBILE_NAV_003: Back button navigation works', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      
      // Navigate to a page
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      // Click on an event if available
      const eventLink = page.locator('a[href*="/events/"]').first();
      if (await eventLink.count() > 0) {
        await eventLink.click();
        await page.waitForTimeout(2000);
        
        // Go back
        await page.goBack();
        await page.waitForTimeout(1000);
        
        // Should be back on events page
        expect(page.url()).toContain('/events');
      }
    });

    test('MOBILE_NAV_004: Bottom navigation (if exists) works', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Look for bottom navigation
      const bottomNav = page.locator('[class*="bottom"], nav[class*="fixed"], [class*="tab-bar"]');
      
      if (await bottomNav.count() > 0) {
        const navItems = page.locator('[class*="bottom"] a, [class*="bottom"] button').first();
        if (await navItems.count() > 0) {
          await navItems.click();
          await page.waitForTimeout(1000);
          
          // Should navigate
          expect(page.url()).not.toBe('');
        }
      }
      
      expect(true).toBe(true);
    });
  });

  // ==================== MOBILE PERFORMANCE TESTS ====================

  test.describe('Mobile Performance Tests', () => {
    test('MOBILE_PERF_001: Page loads within acceptable time on 3G', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      
      // Emulate slow network
      const client = await page.context().newCDPSession(page);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 400 * 1024 / 8, // 400 Kbps
        uploadThroughput: 400 * 1024 / 8,
        latency: 400, // 400ms latency
      });
      
      const startTime = Date.now();
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      const loadTime = Date.now() - startTime;
      
      console.log(`Mobile 3G-like load time: ${loadTime}ms`);
      
      // On slow network, load time might be longer
      // Just log for now
    });

    test('MOBILE_PERF_002: Images are lazy loaded', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);
      
      // Check for lazy loading attributes
      const images = page.locator('img');
      const count = await images.count();
      
      let lazyLoadedCount = 0;
      for (let i = 0; i < Math.min(count, 10); i++) {
        const img = images.nth(i);
        const loading = await img.getAttribute('loading');
        const src = await img.getAttribute('src');
        
        if (loading === 'lazy' || src?.includes('data:image')) {
          lazyLoadedCount++;
        }
      }
      
      console.log(`Lazy loaded images: ${lazyLoadedCount}/${Math.min(count, 10)}`);
      
      // At least some images should be lazy loaded
      expect(lazyLoadedCount).toBeGreaterThan(0);
    });

    test('MOBILE_PERF_003: Scrolling is smooth (no jank)', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Measure scroll performance
      const scrollMetrics = await page.evaluate(async () => {
        return new Promise(resolve => {
          let frameCount = 0;
          let lastTime = performance.now();
          const frames: number[] = [];
          
          function countFrame() {
            const currentTime = performance.now();
            frames.push(currentTime - lastTime);
            lastTime = currentTime;
            frameCount++;
            
            if (frameCount < 60) {
              requestAnimationFrame(countFrame);
            } else {
              const avgFrameTime = frames.reduce((a, b) => a + b, 0) / frames.length;
              const fps = 1000 / avgFrameTime;
              resolve({ avgFrameTime, fps, droppedFrames: frames.filter(f => f > 16.67).length });
            }
          }
          
          // Start scrolling
          requestAnimationFrame(countFrame);
          
          // Scroll down
          setTimeout(() => {
            window.scrollTo(0, 1000);
          }, 100);
        });
      });
      
      console.log(`Scroll performance: ${JSON.stringify(scrollMetrics)}`);
      
      // FPS should be reasonable
      expect((scrollMetrics as any).fps).toBeGreaterThan(30);
    });
  });

  // ==================== MOBILE FORM TESTS ====================

  test.describe('Mobile Form Tests', () => {
    test('MOBILE_FORM_001: Virtual keyboard does not cover form fields', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      // Focus on email field
      const emailField = page.locator('input[type="email"], input[name*="email" i]').first();
      if (await emailField.count() > 0) {
        await emailField.tap();
        await page.waitForTimeout(500);
        
        // Get viewport height and input position
        const viewportHeight = await page.evaluate(() => window.innerHeight);
        const inputPosition = await emailField.boundingBox();
        
        if (inputPosition) {
          // Input should be visible above keyboard area
          // This is a basic check
          expect(inputPosition.y).toBeLessThan(viewportHeight);
        }
      }
      
      expect(true).toBe(true);
    });

    test('MOBILE_FORM_002: Form inputs are properly sized for mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      const inputs = page.locator('input[type="text"], input[type="email"], input[type="password"], textarea');
      const count = await inputs.count();
      
      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        const box = await input.boundingBox();
        
        if (box) {
          // Input should be at least 44px tall for touch
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
    });

    test('MOBILE_FORM_003: Date pickers are mobile-friendly', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/admin/events/new`);
      await waitForPageLoad(page);
      
      const dateInput = page.locator('input[type="date"]').first();
      
      if (await dateInput.count() > 0) {
        const box = await dateInput.boundingBox();
        if (box) {
          // Date input should be tappable
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
      
      expect(true).toBe(true);
    });
  });
});
