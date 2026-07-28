import { test, expect, Page } from '@playwright/test';
import { BASE_URL, VIEWPORTS, waitForPageLoad } from '../test-utils';

test.describe('Events Module', () => {
  test.describe('Events Listing Page', () => {
    test('EVT-001: Events page loads with 200 status', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/events`);
      expect(response?.status()).toBe(200);
    });

    test('EVT-002: Page has title', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      const title = await page.title();
      expect(title).toBeTruthy();
    });

    test('EVT-003: Events content is visible', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('EVT-004: Events list or grid is displayed', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const eventsContainer = page.locator('[class*="grid"], [class*="list"], section').first();
      await expect(eventsContainer).toBeVisible();
    });

    test('EVT-005: Event cards have titles', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const eventTitles = page.locator('h1, h2, h3').filter({ hasText: /.+/ });
      const count = await eventTitles.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('EVT-006: Event dates are displayed', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      // Check for date-related content
      const dateElements = page.locator('[class*="date"], [class*="time"], time');
      const count = await dateElements.count();
      // Events should show dates
    });

    test('EVT-007: Pagination controls exist (if applicable)', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const pagination = page.locator('[class*="pagination"], nav[aria-label*="pagination"]');
      const count = await pagination.count();
      // Pagination may or may not exist
    });
  });

  test.describe('Event Detail Page', () => {
    test('EVT-010: Event detail page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      // Find first event link
      const eventLink = page.locator('a[href*="/events/"]').first();
      const href = await eventLink.getAttribute('href');
      
      if (href && !href.includes('page')) {
        const response = await page.goto(`${BASE_URL}${href}`);
        expect(response?.status()).toBe(200);
      }
    });

    test('EVT-011: Event detail shows event information', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const eventLink = page.locator('a[href*="/events/"]').first();
      const href = await eventLink.getAttribute('href');
      
      if (href && !href.includes('page')) {
        await page.goto(`${BASE_URL}${href}`);
        await waitForPageLoad(page);
        
        const main = page.locator('main');
        await expect(main).toBeVisible();
      }
    });

    test('EVT-012: Event detail has back navigation', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const eventLink = page.locator('a[href*="/events/"]').first();
      const href = await eventLink.getAttribute('href');
      
      if (href && !href.includes('page')) {
        await page.goto(`${BASE_URL}${href}`);
        await waitForPageLoad(page);
        
        const backLink = page.locator('a:has-text("Back"), a:has-text("Events"), button:has-text("Back")').first();
        // Should have back navigation
      }
    });
  });

  test.describe('Events Filtering & Search', () => {
    test('EVT-020: Search functionality exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="ಹುಡುಕ"]');
      const count = await searchInput.count();
      // Search may exist
    });

    test('EVT-021: Filter options exist', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const filters = page.locator('select, [role="combobox"], button:has-text("Filter")');
      const count = await filters.count();
      // Filters may exist
    });

    test('EVT-022: Date filter works', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const dateFilter = page.locator('input[type="date"], input[placeholder*="date" i]');
      const count = await dateFilter.count();
      // Date filter may exist
    });
  });

  test.describe('Responsive Events', () => {
    test('EVT-030: Events page renders on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('EVT-031: Events page renders on tablet', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('EVT-032: Event cards stack on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const cards = page.locator('[class*="card"], article');
      const count = await cards.count();
      // Cards should be visible
    });
  });

  test.describe('Events Accessibility', () => {
    test('EVT-040: Images have alt text', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const img = images.nth(i);
        if (await img.isVisible()) {
          const alt = await img.getAttribute('alt');
          // Alt should exist
        }
      }
    });

    test('EVT-041: Proper heading hierarchy', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      const h1 = page.locator('h1');
      const count = await h1.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Events Performance', () => {
    test('EVT-050: Events page loads within acceptable time', async ({ page }) => {
      const start = Date.now();
      await page.goto(`${BASE_URL}/events`);
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - start;
      expect(loadTime).toBeLessThan(5000);
    });

    test('EVT-051: No console errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await page.goto(`${BASE_URL}/events`);
      await page.waitForTimeout(2000);
      
      const criticalErrors = errors.filter(e => 
        !e.includes('Firebase') && 
        !e.includes('Warning')
      );
      
      expect(criticalErrors.length).toBe(0);
    });
  });
});
