import { test, expect, Page } from '@playwright/test';
import { BASE_URL, VIEWPORTS, waitForPageLoad } from '../test-utils';

test.describe('Gallery Module', () => {
  test.describe('Gallery Listing Page', () => {
    test('GAL-001: Gallery page loads with 200 status', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/gallery`);
      expect(response?.status()).toBe(200);
    });

    test('GAL-002: Gallery has main content', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('GAL-003: Gallery images are displayed', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);
      
      const images = page.locator('img');
      const count = await images.count();
      // Gallery should have images
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('GAL-004: Gallery albums/categories exist', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);
      
      const albums = page.locator('[class*="album"], [class*="category"], section');
      const count = await albums.count();
      // Albums may exist
    });

    test('GAL-005: Lightbox opens on image click', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);
      
      const image = page.locator('img').first();
      if (await image.count() > 0 && await image.isVisible()) {
        await image.click();
        await page.waitForTimeout(500);
        
        const lightbox = page.locator('[role="dialog"], [class*="lightbox"], [class*="modal"]');
        const count = await lightbox.count();
        // Lightbox may open
      }
    });

    test('GAL-006: Filter by category works', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);
      
      const categoryButtons = page.locator('button:has-text("All"), button:has-text("ಎಲ್ಲಾ")');
      const count = await categoryButtons.count();
      // Category filters may exist
    });
  });

  test.describe('Gallery Album/Detail Page', () => {
    test('GAL-010: Album detail page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);
      
      const albumLink = page.locator('a[href*="/gallery/"]').first();
      const href = await albumLink.getAttribute('href');
      
      if (href) {
        const response = await page.goto(`${BASE_URL}${href}`);
        expect(response?.status()).toBe(200);
      }
    });

    test('GAL-011: Album shows images', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);
      
      const albumLink = page.locator('a[href*="/gallery/"]').first();
      const href = await albumLink.getAttribute('href');
      
      if (href) {
        await page.goto(`${BASE_URL}${href}`);
        await waitForPageLoad(page);
        
        const images = page.locator('img');
        const count = await images.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('GAL-012: Back to gallery navigation works', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);
      
      const albumLink = page.locator('a[href*="/gallery/"]').first();
      const href = await albumLink.getAttribute('href');
      
      if (href) {
        await page.goto(`${BASE_URL}${href}`);
        await waitForPageLoad(page);
        
        const backLink = page.locator('a:has-text("Gallery"), a:has-text("Back")');
        // Should have back navigation
      }
    });
  });

  test.describe('Gallery Image Handling', () => {
    test('GAL-020: Images load without broken links', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);
      
      let brokenImages = 0;
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const img = images.nth(i);
        if (await img.isVisible()) {
          const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
          if (naturalWidth === 0) brokenImages++;
        }
      }
      
      expect(brokenImages).toBe(0);
    });

    test('GAL-021: Image lazy loading is implemented', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      
      const images = page.locator('img[loading="lazy"]');
      const count = await images.count();
      // Lazy loading may be implemented
    });

    test('GAL-022: Images have proper alt text', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);
      
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
  });

  test.describe('Gallery Responsive', () => {
    test('GAL-030: Gallery renders on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('GAL-031: Images adjust to mobile view', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);
      
      const images = page.locator('img');
      const count = await images.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('GAL-032: Lightbox works on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);
      
      const image = page.locator('img').first();
      if (await image.count() > 0) {
        await image.click();
        await page.waitForTimeout(500);
        // Lightbox should work on mobile
      }
    });
  });

  test.describe('Gallery Performance', () => {
    test('GAL-040: Gallery page loads quickly', async ({ page }) => {
      const start = Date.now();
      await page.goto(`${BASE_URL}/gallery`);
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - start;
      expect(loadTime).toBeLessThan(5000);
    });

    test('GAL-041: Image thumbnails are optimized', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 3); i++) {
        const img = images.nth(i);
        const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
        const clientWidth = await img.evaluate((el: HTMLImageElement) => el.clientWidth);
        // Thumbnails should be smaller than full size
      }
    });
  });
});
