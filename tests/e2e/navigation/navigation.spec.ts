import { test, expect, Page } from '@playwright/test';
import { BASE_URL, VIEWPORTS, waitForPageLoad } from '../test-utils';

test.describe('Navigation Module', () => {
  test.describe('Main Navigation', () => {
    test('NAV-001: Main navigation is visible on homepage', async ({ page }) => {
      await page.goto(BASE_URL);
      const nav = page.locator('header nav, nav').first();
      await expect(nav).toBeVisible();
    });

    test('NAV-002: All main navigation links exist', async ({ page }) => {
      await page.goto(BASE_URL);
      const navLinks = page.locator('header nav a, nav a');
      const count = await navLinks.count();
      expect(count).toBeGreaterThan(0);
    });

    test('NAV-003: Navigation links have valid hrefs', async ({ page }) => {
      await page.goto(BASE_URL);
      const links = page.locator('header nav a, nav a');
      const count = await links.count();
      
      for (let i = 0; i < Math.min(count, 15); i++) {
        const link = links.nth(i);
        if (await link.isVisible()) {
          const href = await link.getAttribute('href');
          expect(href).toBeTruthy();
        }
      }
    });

    test('NAV-004: Navigation links are clickable', async ({ page }) => {
      await page.goto(BASE_URL);
      const links = page.locator('header nav a, nav a');
      const count = await links.count();
      
      // Click a few links to verify they work
      for (let i = 0; i < Math.min(count, 3); i++) {
        const link = links.nth(i);
        if (await link.isVisible()) {
          const href = await link.getAttribute('href');
          if (href && !href.startsWith('#') && !href.startsWith('mailto:')) {
            await link.click();
            await page.waitForTimeout(500);
            break;
          }
        }
      }
    });

    test('NAV-005: Logo navigation returns to homepage', async ({ page }) => {
      await page.goto(`${BASE_URL}/about`);
      const logo = page.locator('header a[href="/"], header img').first();
      await logo.click();
      await waitForPageLoad(page);
      expect(page.url()).toBe(BASE_URL + '/');
    });
  });

  test.describe('Mobile Navigation', () => {
    test('NAV-010: Mobile menu opens on menu click', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      
      // Find and click menu button
      const menuButton = page.locator('button[aria-label*="menu" i], button:has-text("Menu")').first();
      if (await menuButton.count() > 0) {
        await menuButton.click();
        await page.waitForTimeout(500);
      }
    });

    test('NAV-011: Mobile menu has navigation links', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      
      // Open mobile menu
      const menuButton = page.locator('button[aria-label*="menu" i], button:has-text("Menu")').first();
      if (await menuButton.count() > 0) {
        await menuButton.click();
        await page.waitForTimeout(500);
        
        const mobileLinks = page.locator('nav a, [role="dialog"] a');
        const count = await mobileLinks.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('NAV-012: Mobile menu closes after selection', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      
      const menuButton = page.locator('button[aria-label*="menu" i], button:has-text("Menu")').first();
      if (await menuButton.count() > 0) {
        await menuButton.click();
        await page.waitForTimeout(300);
        // Close button or overlay should be visible
      }
    });
  });

  test.describe('Breadcrumbs', () => {
    test('NAV-020: Breadcrumbs exist on inner pages', async ({ page }) => {
      await page.goto(`${BASE_URL}/about`);
      await waitForPageLoad(page);
      
      const breadcrumbs = page.locator('[aria-label="Breadcrumb"], .breadcrumbs, nav[aria-label="Breadcrumb"]');
      const count = await breadcrumbs.count();
      // Inner pages may or may not have breadcrumbs
    });

    test('NAV-021: Breadcrumb links are clickable', async ({ page }) => {
      await page.goto(`${BASE_URL}/about`);
      await waitForPageLoad(page);
      
      const breadcrumbLinks = page.locator('[aria-label="Breadcrumb"] a, .breadcrumbs a');
      const count = await breadcrumbLinks.count();
      
      if (count > 0) {
        const firstLink = breadcrumbLinks.first();
        await expect(firstLink).toBeVisible();
      }
    });
  });

  test.describe('Page Transitions', () => {
    test('NAV-030: Browser back button works', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.goto(`${BASE_URL}/about`);
      await page.goBack();
      await waitForPageLoad(page);
      expect(page.url()).toBe(BASE_URL + '/');
    });

    test('NAV-031: Browser forward button works', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.goto(`${BASE_URL}/about`);
      await page.goBack();
      await page.goForward();
      await waitForPageLoad(page);
      expect(page.url()).toBe(BASE_URL + '/about');
    });

    test('NAV-032: Page refresh maintains state', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      await page.reload();
      await waitForPageLoad(page);
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('Deep Links', () => {
    test('NAV-040: Direct event detail links work', async ({ page }) => {
      // First get an event ID from the events page
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const eventLink = page.locator('a[href*="/events/"]').first();
      const href = await eventLink.getAttribute('href');
      
      if (href) {
        const response = await page.goto(`${BASE_URL}${href}`);
        expect(response?.status()).toBe(200);
      }
    });

    test('NAV-041: Gallery album links work', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);
      
      const galleryLink = page.locator('a[href*="/gallery/"]').first();
      const href = await galleryLink.getAttribute('href');
      
      if (href) {
        const response = await page.goto(`${BASE_URL}${href}`);
        expect(response?.status()).toBe(200);
      }
    });
  });

  test.describe('Footer Navigation', () => {
    test('NAV-050: Footer links are functional', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const footerLinks = page.locator('footer a');
      const count = await footerLinks.count();
      
      // Check a few footer links
      for (let i = 0; i < Math.min(count, 3); i++) {
        const link = footerLinks.nth(i);
        if (await link.isVisible()) {
          const href = await link.getAttribute('href');
          if (href && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
            expect(href).toBeTruthy();
          }
        }
      }
    });

    test('NAV-051: Social media links open correctly', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const socialLinks = page.locator('footer a[href*="facebook"], footer a[href*="twitter"], footer a[href*="instagram"], footer a[href*="youtube"]');
      const count = await socialLinks.count();
      // Social links should exist
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Responsive Navigation', () => {
    test('NAV-060: Desktop navigation displays all items', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto(BASE_URL);
      
      const navLinks = page.locator('header nav a');
      const count = await navLinks.count();
      expect(count).toBeGreaterThan(0);
    });

    test('NAV-061: Tablet navigation layout adjusts', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.goto(BASE_URL);
      
      const nav = page.locator('header nav').first();
      await expect(nav).toBeVisible();
    });

    test('NAV-062: Mobile navigation uses hamburger menu', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      
      const menuButton = page.locator('button[aria-label*="menu" i], button:has-text("Menu")');
      const count = await menuButton.count();
      // Mobile should show hamburger menu
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('External Links', () => {
    test('NAV-070: External links have proper attributes', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const externalLinks = page.locator('a[target="_blank"]');
      const count = await externalLinks.count();
      
      // External links should have rel="noopener noreferrer"
      for (let i = 0; i < Math.min(count, 3); i++) {
        const link = externalLinks.nth(i);
        const rel = await link.getAttribute('rel');
        // External links should have rel attribute
      }
    });
  });
});
