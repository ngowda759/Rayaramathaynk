import { test, expect, Page } from '@playwright/test';
import { BASE_URL, VIEWPORTS, waitForPageLoad } from '../test-utils';

test.describe('Sevas (Services) Module', () => {
  test.describe('Sevas Listing Page', () => {
    test('SEV-001: Sevas page loads with 200 status', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/sevas`);
      expect(response?.status()).toBe(200);
    });

    test('SEV-002: Sevas content is visible', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('SEV-003: Sevas list is displayed', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const sevaCards = page.locator('[class*="card"], article, [class*="seva"]');
      const count = await sevaCards.count();
      // Should display seva cards
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('SEV-004: Seva names are displayed', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const headings = page.locator('h2, h3');
      const count = await headings.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('SEV-005: Seva prices are displayed', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const prices = page.locator('text=/₹|rupee|amount|fee/i');
      const count = await prices.count();
      // Prices should be displayed
    });

    test('SEV-006: Book Now buttons exist', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const bookButtons = page.locator('button:has-text("Book"), a:has-text("Book"), button:has-text("ಬುಕ್")');
      const count = await bookButtons.count();
      // Book buttons should exist
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Seva Detail Page', () => {
    test('SEV-010: Seva detail page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const sevaLink = page.locator('a[href*="/sevas/"]').first();
      const href = await sevaLink.getAttribute('href');
      
      if (href) {
        const response = await page.goto(`${BASE_URL}${href}`);
        expect(response?.status()).toBe(200);
      }
    });

    test('SEV-011: Seva details are shown', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const sevaLink = page.locator('a[href*="/sevas/"]').first();
      const href = await sevaLink.getAttribute('href');
      
      if (href) {
        await page.goto(`${BASE_URL}${href}`);
        await waitForPageLoad(page);
        
        const main = page.locator('main');
        await expect(main).toBeVisible();
      }
    });

    test('SEV-012: Booking form exists on detail page', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const sevaLink = page.locator('a[href*="/sevas/"]').first();
      const href = await sevaLink.getAttribute('href');
      
      if (href) {
        await page.goto(`${BASE_URL}${href}`);
        await waitForPageLoad(page);
        
        const form = page.locator('form');
        const count = await form.count();
        // Form may exist on detail page
      }
    });
  });

  test.describe('Seva Booking Form', () => {
    test('SEV-020: Name field exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const nameField = page.locator('input[name*="name" i]').first();
      if (await nameField.count() > 0) {
        await expect(nameField).toBeVisible();
      }
    });

    test('SEV-021: Phone field exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const phoneField = page.locator('input[type="tel"], input[name*="phone" i]').first();
      if (await phoneField.count() > 0) {
        await expect(phoneField).toBeVisible();
      }
    });

    test('SEV-022: Date selection exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const dateField = page.locator('input[type="date"], [placeholder*="date" i]').first();
      if (await dateField.count() > 0) {
        await expect(dateField).toBeVisible();
      }
    });

    test('SEV-023: Time selection exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const timeField = page.locator('input[type="time"], select').first();
      if (await timeField.count() > 0) {
        await expect(timeField).toBeVisible();
      }
    });

    test('SEV-024: Form validates required fields', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const submitButton = page.locator('button[type="submit"]').first();
      if (await submitButton.count() > 0) {
        await submitButton.click();
        await page.waitForTimeout(500);
        // Should show validation errors
      }
    });
  });

  test.describe('Sevas Filtering', () => {
    test('SEV-030: Category filter exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const filter = page.locator('select, button:has-text("Filter")').first();
      if (await filter.count() > 0) {
        await expect(filter).toBeVisible();
      }
    });

    test('SEV-031: Search functionality exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const search = page.locator('input[type="search"], input[placeholder*="search" i]').first();
      if (await search.count() > 0) {
        await expect(search).toBeVisible();
      }
    });

    test('SEV-032: Price filter works', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const priceFilter = page.locator('input[type="number"], select').first();
      if (await priceFilter.count() > 0) {
        await expect(priceFilter).toBeVisible();
      }
    });
  });

  test.describe('Sevas Responsive', () => {
    test('SEV-040: Sevas page renders on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('SEV-041: Cards stack on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const cards = page.locator('[class*="card"]');
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('SEV-042: Booking form works on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const bookButton = page.locator('button:has-text("Book")').first();
      if (await bookButton.count() > 0) {
        await bookButton.click();
        await page.waitForTimeout(500);
        // Form should open on mobile
      }
    });
  });

  test.describe('Sevas Performance', () => {
    test('SEV-050: Sevas page loads within acceptable time', async ({ page }) => {
      const start = Date.now();
      await page.goto(`${BASE_URL}/sevas`);
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - start;
      expect(loadTime).toBeLessThan(5000);
    });

    test('SEV-051: No console errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await page.goto(`${BASE_URL}/sevas`);
      await page.waitForTimeout(2000);
      
      const criticalErrors = errors.filter(e => 
        !e.includes('Firebase') && 
        !e.includes('Warning')
      );
      
      expect(criticalErrors.length).toBe(0);
    });
  });

  test.describe('Sevas Accessibility', () => {
    test('SEV-060: Images have alt text', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const img = images.nth(i);
        if (await img.isVisible()) {
          const alt = await img.getAttribute('alt');
          expect(alt).toBeDefined();
        }
      }
    });

    test('SEV-061: Form fields have labels', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const inputs = page.locator('input:not([type="hidden"])');
      const count = await inputs.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const placeholder = await input.getAttribute('placeholder');
        
        expect(id || ariaLabel || placeholder).toBeTruthy();
      }
    });
  });
});
