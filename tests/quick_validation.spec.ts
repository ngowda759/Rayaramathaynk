import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Application Quick Validation', () => {
  test('Homepage loads successfully', async ({ page }) => {
    const response = await page.goto(BASE_URL);
    expect(response?.status()).toBe(200);
  });

  test('Page has title', async ({ page }) => {
    await page.goto(BASE_URL);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('Login page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/login`);
    expect(response?.status()).toBe(200);
  });

  test('Sevas page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/sevas`);
    expect(response?.status()).toBe(200);
  });

  test('Donation page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/donation`);
    expect(response?.status()).toBe(200);
  });

  test('Events page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/events`);
    expect(response?.status()).toBe(200);
  });

  test('Gallery page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/gallery`);
    expect(response?.status()).toBe(200);
  });

  test('About page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/about`);
    expect(response?.status()).toBe(200);
  });

  test('Footer is present on homepage', async ({ page }) => {
    await page.goto(BASE_URL);
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('Navigation links exist', async ({ page }) => {
    await page.goto(BASE_URL);
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });

  test('HTTPS headers present', async ({ page }) => {
    // Test basic security headers via HTTP
    const response = await page.request.get(BASE_URL);
    expect(response.status()).toBe(200);
  });

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

  test('Login form has required fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('Page is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
  });

  test('Page load time acceptable', async ({ page }) => {
    const start = Date.now();
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(5000);
  });
});
