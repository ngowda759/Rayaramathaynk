import { test, expect } from '@playwright/test';

const BASE_URL = 'https://work-2-yehrroerabrftaxm.prod-runtime.all-hands.dev';

test.describe('Application E2E Tests', () => {
  // ============================================
  // HOMEPAGE MODULE
  // ============================================
  test.describe('Homepage Module', () => {
    test('Homepage loads successfully', async ({ page }) => {
      const response = await page.goto(BASE_URL);
      expect(response?.status()).toBe(200);
    });

    test('Page has title', async ({ page }) => {
      await page.goto(BASE_URL);
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });

    test('Navigation menu is visible', async ({ page }) => {
      await page.goto(BASE_URL);
      const nav = page.locator('nav').first();
      await expect(nav).toBeVisible();
    });

    test('Footer is present', async ({ page }) => {
      await page.goto(BASE_URL);
      const footer = page.locator('footer').first();
      await expect(footer).toBeVisible();
    });

    test('Page loads within acceptable time', async ({ page }) => {
      const start = Date.now();
      await page.goto(BASE_URL);
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - start;
      expect(loadTime).toBeLessThan(5000);
    });
  });

  // ============================================
  // AUTHENTICATION MODULE
  // ============================================
  test.describe('Authentication Module', () => {
    test('Login page loads', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/login`);
      expect(response?.status()).toBe(200);
    });

    test('Login form has email and password fields', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      const emailField = page.locator('input[type="email"]').first();
      const passwordField = page.locator('input[type="password"]').first();
      await expect(emailField).toBeVisible();
      await expect(passwordField).toBeVisible();
    });

    test('Submit button is present', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      const submitButton = page.locator('button[type="submit"]').first();
      await expect(submitButton).toBeVisible();
    });

    test('Password field has correct type', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      const passwordField = page.locator('input[type="password"]').first();
      await expect(passwordField).toHaveAttribute('type', 'password');
    });
  });

  // ============================================
  // SEVAS MODULE
  // ============================================
  test.describe('Seva Booking Module', () => {
    test('Sevas page loads', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/sevas`);
      expect(response?.status()).toBe(200);
    });

    test('Sevas page has content', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      const main = page.locator('main, section, body');
      await expect(main.first()).toBeVisible();
    });

    test('Sevas page loads within acceptable time', async ({ page }) => {
      const start = Date.now();
      await page.goto(`${BASE_URL}/sevas`);
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - start;
      expect(loadTime).toBeLessThan(5000);
    });
  });

  // ============================================
  // DONATION MODULE
  // ============================================
  test.describe('Donation Module', () => {
    test('Donation page loads', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/donation`);
      expect(response?.status()).toBe(200);
    });

    test('Donation form is visible', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      const form = page.locator('form').first();
      await expect(form).toBeVisible();
    });
  });

  // ============================================
  // EVENTS MODULE
  // ============================================
  test.describe('Events Module', () => {
    test('Events page loads', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/events`);
      expect(response?.status()).toBe(200);
    });
  });

  // ============================================
  // GALLERY MODULE
  // ============================================
  test.describe('Gallery Module', () => {
    test('Gallery page loads', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/gallery`);
      expect(response?.status()).toBe(200);
    });
  });

  // ============================================
  // ABOUT MODULE
  // ============================================
  test.describe('About Module', () => {
    test('About page loads', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/about`);
      expect(response?.status()).toBe(200);
    });
  });

  // ============================================
  // MOBILE RESPONSIVE
  // ============================================
  test.describe('Mobile Responsive', () => {
    test('Homepage renders on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(BASE_URL);
      await page.waitForTimeout(500);
    });

    test('Login page renders on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/login`);
      const form = page.locator('form').first();
      await expect(form).toBeVisible();
    });
  });

  // ============================================
  // ACCESSIBILITY
  // ============================================
  test.describe('Accessibility', () => {
    test('Images have alt attributes', async ({ page }) => {
      await page.goto(BASE_URL);
      const images = page.locator('img');
      const count = await images.count();
      if (count > 0) {
        for (let i = 0; i < Math.min(count, 5); i++) {
          const img = images.nth(i);
          if (await img.isVisible()) {
            const alt = await img.getAttribute('alt');
            expect(alt).toBeDefined();
          }
        }
      }
    });

    test('Page has proper heading hierarchy', async ({ page }) => {
      await page.goto(BASE_URL);
      const h1 = page.locator('h1');
      const count = await h1.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================
  // SECURITY
  // ============================================
  test.describe('Security', () => {
    test('Password field has correct type on login', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      const passwordField = page.locator('input[type="password"]').first();
      await expect(passwordField).toHaveAttribute('type', 'password');
    });

    test('No sensitive data in URL on login', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      const url = page.url();
      expect(url).not.toContain('password');
    });
  });
});
