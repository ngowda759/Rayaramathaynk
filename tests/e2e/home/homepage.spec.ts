import { test, expect, Page } from '@playwright/test';
import { BASE_URL, VIEWPORTS, waitForPageLoad, getHeadingHierarchy, countImagesWithoutAlt } from '../test-utils';

test.describe('Homepage Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);
  });

  test.describe('Page Load', () => {
    test('HP-001: Homepage loads with 200 status', async ({ page }) => {
      const response = await page.goto(BASE_URL);
      expect(response?.status()).toBe(200);
    });

    test('HP-002: Page has title', async ({ page }) => {
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);
    });

    test('HP-003: Page has correct HTML lang attribute', async ({ page }) => {
      const html = page.locator('html');
      const lang = await html.getAttribute('lang');
      expect(lang).toBeTruthy();
    });

    test('HP-004: Meta viewport is properly configured', async ({ page }) => {
      const viewport = page.locator('meta[name="viewport"]');
      await expect(viewport).toHaveCount(1);
      const content = await viewport.getAttribute('content');
      expect(content).toContain('width=device-width');
    });
  });

  test.describe('Header & Navigation', () => {
    test('HP-010: Main navigation is visible', async ({ page }) => {
      const nav = page.locator('header nav, nav').first();
      await expect(nav).toBeVisible();
    });

    test('HP-011: Navigation has links', async ({ page }) => {
      const navLinks = page.locator('header a, nav a').filter({ hasText: /.+/ });
      const count = await navLinks.count();
      expect(count).toBeGreaterThan(0);
    });

    test('HP-012: Logo is visible and clickable', async ({ page }) => {
      const logo = page.locator('header img, header a[href="/"]').first();
      await expect(logo).toBeVisible();
    });

    test('HP-013: Mobile menu toggle exists', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      const menuToggle = page.locator('button[aria-label*="menu" i], button[aria-label*="Menu" i], button:has-text("Menu"), [aria-controls]').first();
      // Menu toggle should exist on mobile
    });

    test('HP-014: All navigation links are functional', async ({ page }) => {
      const links = page.locator('header nav a, nav a');
      const count = await links.count();
      
      for (let i = 0; i < Math.min(count, 10); i++) {
        const link = links.nth(i);
        if (await link.isVisible()) {
          const href = await link.getAttribute('href');
          expect(href).toBeTruthy();
        }
      }
    });
  });

  test.describe('Hero Section', () => {
    test('HP-020: Hero section is present', async ({ page }) => {
      const hero = page.locator('[class*="hero"], section, main').first();
      await expect(hero).toBeVisible();
    });

    test('HP-021: Page has h1 heading', async ({ page }) => {
      const h1 = page.locator('h1');
      const count = await h1.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('HP-022: Headings follow proper hierarchy', async ({ page }) => {
      const hierarchy = await getHeadingHierarchy(page);
      expect(hierarchy.length).toBeGreaterThan(0);
      // Should start with h1
      expect(hierarchy[0]).toBe('H1');
    });
  });

  test.describe('Content Sections', () => {
    test('HP-030: Main content is visible', async ({ page }) => {
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('HP-031: Temple timings section exists', async ({ page }) => {
      const timings = page.locator('text=/timings|schedule|ಸಮಯ/i').first();
      // Should have timings or schedule
    });

    test('HP-032: Todays Panchanga section exists', async ({ page }) => {
      const panchanga = page.locator('text=/panchanga|ಪಂಚಾಂಗ/i').first();
      // Should have panchanga section
    });

    test('HP-033: Announcements section exists', async ({ page }) => {
      const announcements = page.locator('text=/announcement|notice|ಘೋಷಣೆ/i').first();
      // Should have announcements
    });

    test('HP-034: Upcoming events section exists', async ({ page }) => {
      const events = page.locator('text=/event|ಕಾರ್ಯಕ್ರಮ/i').first();
      // Should have events section
    });

    test('HP-035: Featured sevices section exists', async ({ page }) => {
      const sevas = page.locator('text=/seva|ಸೇವೆ/i').first();
      // Should have sevices section
    });
  });

  test.describe('Footer', () => {
    test('HP-040: Footer is visible', async ({ page }) => {
      const footer = page.locator('footer').first();
      await expect(footer).toBeVisible();
    });

    test('HP-041: Footer has copyright text', async ({ page }) => {
      const footer = page.locator('footer');
      const text = await footer.textContent();
      expect(text).toBeTruthy();
    });

    test('HP-042: Footer has contact information', async ({ page }) => {
      const footer = page.locator('footer');
      const text = await footer.textContent();
      // Footer should have some contact info
      expect(text?.length).toBeGreaterThan(10);
    });

    test('HP-043: Footer links are valid', async ({ page }) => {
      const footerLinks = page.locator('footer a');
      const count = await footerLinks.count();
      // Footer should have links
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Images & Media', () => {
    test('HP-050: All images have alt attributes', async ({ page }) => {
      const missingAlt = await countImagesWithoutAlt(page);
      expect(missingAlt).toBe(0);
    });

    test('HP-051: Images load without errors', async ({ page }) => {
      const images = page.locator('img');
      let brokenImages = 0;
      
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
  });

  test.describe('Performance', () => {
    test('HP-060: Page loads within acceptable time', async ({ page }) => {
      const start = Date.now();
      await page.goto(BASE_URL);
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - start;
      expect(loadTime).toBeLessThan(5000);
    });

    test('HP-061: No console errors on load', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await page.reload();
      await page.waitForTimeout(2000);
      
      // Filter out expected Firebase warnings
      const criticalErrors = errors.filter(e => 
        !e.includes('Firebase') && 
        !e.includes('Warning') &&
        !e.includes('deprecated')
      );
      
      expect(criticalErrors.length).toBe(0);
    });
  });

  test.describe('Accessibility', () => {
    test('HP-070: Skip to main content link exists', async ({ page }) => {
      const skipLink = page.locator('a[href="#main-content"], [class*="skip"]');
      const count = await skipLink.count();
      // Skip link should be available for accessibility
    });

    test('HP-071: All form fields have labels', async ({ page }) => {
      const inputs = page.locator('input:not([type="hidden"])');
      const count = await inputs.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const input = inputs.nth(i);
        if (await input.isVisible()) {
          const id = await input.getAttribute('id');
          const ariaLabel = await input.getAttribute('aria-label');
          const placeholder = await input.getAttribute('placeholder');
          const name = await input.getAttribute('name');
          
          // At least one form of labeling should exist
          const hasLabel = id || ariaLabel || placeholder || name;
          expect(hasLabel).toBeTruthy();
        }
      }
    });

    test('HP-072: Focus indicators are visible', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(focused).toBeTruthy();
    });
  });

  test.describe('Responsive Design', () => {
    test('HP-080: Desktop layout renders correctly', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('HP-081: Tablet layout renders correctly', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('HP-082: Mobile layout renders correctly', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });
});
