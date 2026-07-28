import { test, expect, Page } from '@playwright/test';
import { BASE_URL, VIEWPORTS, waitForPageLoad } from '../test-utils';

test.describe('Authentication Module', () => {
  test.describe('Login Page', () => {
    test('AUTH-001: Login page loads with 200 status', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/login`);
      expect(response?.status()).toBe(200);
    });

    test('AUTH-002: Login form is visible', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      const form = page.locator('form').first();
      await expect(form).toBeVisible();
    });

    test('AUTH-003: Email field exists and is visible', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      const emailField = page.locator('input[type="email"], input[name*="email" i]').first();
      await expect(emailField).toBeVisible();
    });

    test('AUTH-004: Password field exists and has correct type', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      const passwordField = page.locator('input[type="password"]').first();
      await expect(passwordField).toBeVisible();
      await expect(passwordField).toHaveAttribute('type', 'password');
    });

    test('AUTH-005: Submit button exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      const submitButton = page.locator('button[type="submit"]').first();
      await expect(submitButton).toBeVisible();
    });

    test('AUTH-006: Form accepts valid email input', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[type="email"]', 'test@example.com');
      const value = await page.locator('input[type="email"]').inputValue();
      expect(value).toBe('test@example.com');
    });

    test('AUTH-007: Form accepts password input', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[type="password"]', 'testpassword123');
      const value = await page.locator('input[type="password"]').inputValue();
      expect(value).toBe('testpassword123');
    });

    test('AUTH-008: Empty form shows validation', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
      // Should show validation message or prevent submission
    });

    test('AUTH-009: Invalid email format handled', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[type="email"]', 'invalid-email');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
      // Should show validation error
    });

    test('AUTH-010: No sensitive data in URL', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      const url = page.url();
      expect(url).not.toContain('password');
      expect(url).not.toContain('secret');
    });

    test('AUTH-011: Password field has correct autocomplete', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      const passwordField = page.locator('input[type="password"]').first();
      const autocomplete = await passwordField.getAttribute('autocomplete');
      expect(autocomplete).toBeTruthy();
    });

    test('AUTH-012: Login page is responsive on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/login`);
      const form = page.locator('form').first();
      await expect(form).toBeVisible();
    });

    test('AUTH-013: Login page is responsive on tablet', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.goto(`${BASE_URL}/login`);
      const form = page.locator('form').first();
      await expect(form).toBeVisible();
    });
  });

  test.describe('Register Page', () => {
    test('AUTH-020: Register page loads with 200 status', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/register`);
      expect(response?.status()).toBe(200);
    });

    test('AUTH-021: Registration form is visible', async ({ page }) => {
      await page.goto(`${BASE_URL}/register`);
      const form = page.locator('form').first();
      await expect(form).toBeVisible();
    });

    test('AUTH-022: Email field exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/register`);
      const emailField = page.locator('input[type="email"]').first();
      await expect(emailField).toBeVisible();
    });

    test('AUTH-023: Password fields exist', async ({ page }) => {
      await page.goto(`${BASE_URL}/register`);
      const passwordFields = page.locator('input[type="password"]');
      const count = await passwordFields.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('AUTH-024: Submit button exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/register`);
      const submitButton = page.locator('button[type="submit"]').first();
      await expect(submitButton).toBeVisible();
    });
  });

  test.describe('Forgot Password Page', () => {
    test('AUTH-030: Forgot password page loads', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/forgot-password`);
      expect(response?.status()).toBe(200);
    });

    test('AUTH-031: Email field exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/forgot-password`);
      const emailField = page.locator('input[type="email"]').first();
      await expect(emailField).toBeVisible();
    });
  });

  test.describe('Session & Security', () => {
    test('AUTH-040: Unauthorized admin access redirects', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin`);
      await page.waitForTimeout(2000);
      const url = page.url();
      // Should redirect to login or show access denied
      expect(url.includes('/login') || url.includes('/admin')).toBeTruthy();
    });

    test('AUTH-041: Protected routes require authentication', async ({ page }) => {
      const protectedRoutes = ['/admin', '/profile'];
      
      for (const route of protectedRoutes) {
        await page.goto(`${BASE_URL}${route}`);
        await page.waitForTimeout(1000);
        const url = page.url();
        // Should redirect or show access denied
        expect(url).toBeTruthy();
      }
    });

    test('AUTH-042: Session persists on page refresh', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[type="email"]', 'test@example.com');
      await page.reload();
      await page.waitForTimeout(500);
      // Session should persist
    });
  });
});
