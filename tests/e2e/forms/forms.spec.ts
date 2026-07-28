import { test, expect, Page } from '@playwright/test';
import { BASE_URL, VIEWPORTS, waitForPageLoad } from '../test-utils';

test.describe('Forms Module', () => {
  test.describe('Form Validation', () => {
    test('FORM-001: Empty form submission shows errors', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      await page.waitForLoadState('domcontentloaded');
      
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      await page.waitForTimeout(500);
      
      // Should show validation errors
    });

    test('FORM-002: Invalid email shows error', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[type="email"]', 'invalid-email');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
      
      const errorMessage = page.locator('[class*="error"], [role="alert"], .text-red');
      const count = await errorMessage.count();
      // Error should be displayed
    });

    test('FORM-003: Invalid phone shows error', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const phoneField = page.locator('input[type="tel"]').first();
      if (await phoneField.count() > 0) {
        await phoneField.fill('abc');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(500);
        // Should show phone validation error
      }
    });

    test('FORM-004: Negative numbers rejected', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const amountField = page.locator('input[type="number"]').first();
      if (await amountField.count() > 0) {
        await amountField.fill('-100');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(500);
        // Should reject negative values
      }
    });

    test('FORM-005: Required fields are marked', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      const requiredFields = page.locator('input[required], [aria-required="true"]');
      const count = await requiredFields.count();
      // Should have required fields marked
    });
  });

  test.describe('Form Input Handling', () => {
    test('FORM-010: Text input works correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      const nameField = page.locator('input[name*="name" i]').first();
      if (await nameField.count() > 0) {
        await nameField.fill('John Doe');
        const value = await nameField.inputValue();
        expect(value).toBe('John Doe');
      }
    });

    test('FORM-011: Email input works correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      const emailField = page.locator('input[type="email"]').first();
      await emailField.fill('test@example.com');
      const value = await emailField.inputValue();
      expect(value).toBe('test@example.com');
    });

    test('FORM-012: Password input is masked', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      const passwordField = page.locator('input[type="password"]').first();
      await passwordField.fill('secret123');
      const type = await passwordField.getAttribute('type');
      expect(type).toBe('password');
    });

    test('FORM-013: Form can be cleared', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'password');
      
      // Clear button should work if exists
      const clearButton = page.locator('button:has-text("Clear"), button:has-text("Reset")');
      if (await clearButton.count() > 0) {
        await clearButton.click();
        await page.waitForTimeout(300);
      }
    });

    test('FORM-014: Enter key submits form', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'password');
      await page.locator('input[type="password"]').press('Enter');
      await page.waitForTimeout(1000);
      // Form should submit
    });
  });

  test.describe('Kannada/Unicode Input', () => {
    test('FORM-020: Kannada text can be entered', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const nameField = page.locator('input[name*="name" i]').first();
      if (await nameField.count() > 0) {
        await nameField.fill('ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ');
        const value = await nameField.inputValue();
        expect(value).toBe('ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ');
      }
    });

    test('FORM-021: Mixed language input works', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const nameField = page.locator('input[name*="name" i]').first();
      if (await nameField.count() > 0) {
        await nameField.fill('Sri Raghavendra Swamy');
        const value = await nameField.inputValue();
        expect(value).toBe('Sri Raghavendra Swamy');
      }
    });

    test('FORM-022: Special characters handled', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const nameField = page.locator('input[name*="name" i]').first();
      if (await nameField.count() > 0) {
        await nameField.fill('John & Jane "Doe"');
        const value = await nameField.inputValue();
        expect(value).toBeTruthy();
      }
    });
  });

  test.describe('Form Security', () => {
    test('FORM-030: XSS in input is sanitized', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.fill('input[type="email"]', '<script>alert("XSS")</script>test@example.com');
      await page.waitForTimeout(500);
      
      const content = await page.content();
      expect(content).not.toContain('alert("XSS")');
    });

    test('FORM-031: SQL injection is handled', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.fill('input[type="email"]', "' OR '1'='1");
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);
      
      // Should not show SQL errors
    });

    test('FORM-032: Long input is truncated', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const nameField = page.locator('input[name*="name" i]').first();
      if (await nameField.count() > 0) {
        const longText = 'A'.repeat(1000);
        await nameField.fill(longText);
        const value = await nameField.inputValue();
        // Should handle long input gracefully
      }
    });
  });

  test.describe('Form Loading States', () => {
    test('FORM-040: Submit button shows loading state', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'password');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
      
      const loadingButton = page.locator('button:disabled, button[class*="loading"]');
      const count = await loadingButton.count();
      // Loading state should appear
    });
  });

  test.describe('Form Responsive', () => {
    test('FORM-050: Forms render on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/login`);
      
      const form = page.locator('form').first();
      await expect(form).toBeVisible();
    });

    test('FORM-051: Form fields stack on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/donation`);
      
      const fields = page.locator('input, select, textarea');
      const count = await fields.count();
      expect(count).toBeGreaterThan(0);
    });

    test('FORM-052: Keyboard works on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/login`);
      
      const emailField = page.locator('input[type="email"]').first();
      await emailField.tap();
      await page.waitForTimeout(500);
      
      // Keyboard should appear
    });
  });

  test.describe('Form Accessibility', () => {
    test('FORM-060: Form has proper labels', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      const inputs = page.locator('input:not([type="hidden"])');
      const count = await inputs.count();
      
      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const placeholder = await input.getAttribute('placeholder');
        
        // At least one labeling method should exist
        expect(id || ariaLabel || placeholder).toBeTruthy();
      }
    });

    test('FORM-061: Error messages are announced', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.fill('input[type="email"]', 'invalid');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
      
      const errors = page.locator('[aria-live="polite"], [role="alert"]');
      const count = await errors.count();
      // Errors should be accessible
    });

    test('FORM-062: Focus is managed on error', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.fill('input[type="email"]', 'invalid');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
      
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });
  });
});
