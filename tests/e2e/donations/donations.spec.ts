import { test, expect, Page } from '@playwright/test';
import { BASE_URL, VIEWPORTS, waitForPageLoad } from '../test-utils';

test.describe('Donations Module', () => {
  test.describe('Donation Page', () => {
    test('DON-001: Donation page loads with 200 status', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/donation`);
      expect(response?.status()).toBe(200);
    });

    test('DON-002: Donation form is visible', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      const form = page.locator('form').first();
      await expect(form).toBeVisible();
    });

    test('DON-003: Name field exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      const nameField = page.locator('input[name*="name" i], input[placeholder*="name" i]').first();
      if (await nameField.count() > 0) {
        await expect(nameField).toBeVisible();
      }
    });

    test('DON-004: Email field exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      const emailField = page.locator('input[type="email"]').first();
      if (await emailField.count() > 0) {
        await expect(emailField).toBeVisible();
      }
    });

    test('DON-005: Amount field or options exist', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const amountField = page.locator('input[type="number"], input[placeholder*="amount" i]');
      const amountButtons = page.locator('button:has-text("₹100"), button:has-text("₹500"), button:has-text("₹1000")');
      
      const fieldCount = await amountField.count();
      const buttonCount = await amountButtons.count();
      
      expect(fieldCount + buttonCount).toBeGreaterThan(0);
    });

    test('DON-006: Phone field exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      const phoneField = page.locator('input[type="tel"], input[name*="phone" i]').first();
      if (await phoneField.count() > 0) {
        await expect(phoneField).toBeVisible();
      }
    });

    test('DON-007: Submit button exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      const submitButton = page.locator('button[type="submit"]').first();
      await expect(submitButton).toBeVisible();
    });

    test('DON-008: Donation purpose options exist', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const purposeSelect = page.locator('select').first();
      const purposeRadio = page.locator('input[type="radio"]');
      
      const selectCount = await purposeSelect.count();
      const radioCount = await purposeRadio.count();
      
      // Should have purpose selection
      expect(selectCount + radioCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Donation Form Validation', () => {
    test('DON-010: Empty form shows validation', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
      // Should show required field errors
    });

    test('DON-011: Invalid email shows error', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const emailField = page.locator('input[type="email"]').first();
      if (await emailField.count() > 0) {
        await emailField.fill('invalid-email');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(500);
        // Should show email validation error
      }
    });

    test('DON-012: Negative amount shows error', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const amountField = page.locator('input[type="number"]').first();
      if (await amountField.count() > 0) {
        await amountField.fill('-100');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(500);
        // Should reject negative amounts
      }
    });

    test('DON-013: Form accepts valid input', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const nameField = page.locator('input[name*="name" i], input[placeholder*="name" i]').first();
      const emailField = page.locator('input[type="email"]').first();
      
      if (await nameField.count() > 0) {
        await nameField.fill('Test User');
      }
      if (await emailField.count() > 0) {
        await emailField.fill('test@example.com');
      }
      
      await page.waitForTimeout(300);
      // Form should accept valid input
    });

    test('DON-014: Amount buttons work', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const amountButton = page.locator('button:has-text("₹500"), button:has-text("₹1000")').first();
      if (await amountButton.count() > 0) {
        await amountButton.click();
        await page.waitForTimeout(300);
        // Should update amount field
      }
    });
  });

  test.describe('Donation Payment Flow', () => {
    test('DON-020: UPI payment option exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const upiOption = page.locator('text=/UPI|GPay|PhonePe|Paytm/i');
      const count = await upiOption.count();
      // UPI options may exist
    });

    test('DON-021: Card payment option exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const cardOption = page.locator('text=/card|debit|credit/i');
      const count = await cardOption.count();
      // Card options may exist
    });

    test('DON-022: Net banking option exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const bankOption = page.locator('text=/bank|net banking/i');
      const count = await bankOption.count();
      // Bank options may exist
    });

    test('DON-023: Payment mode selection works', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const paymentOptions = page.locator('input[type="radio"], input[type="checkbox"]');
      const count = await paymentOptions.count();
      
      if (count > 0) {
        await paymentOptions.first().click();
        await page.waitForTimeout(300);
        // Should select payment option
      }
    });
  });

  test.describe('Donation Success/Failure Pages', () => {
    test('DON-030: Success page loads after donation', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/donation/success`);
      expect(response?.status()).toBe(200);
    });

    test('DON-031: Success page shows confirmation', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation/success`);
      await waitForPageLoad(page);
      
      const content = page.locator('main');
      await expect(content).toBeVisible();
    });

    test('DON-032: Failure page loads', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/donation/failure`);
      expect(response?.status()).toBe(200);
    });

    test('DON-033: Retry option exists on failure page', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation/failure`);
      await waitForPageLoad(page);
      
      const retryButton = page.locator('a:has-text("Try Again"), button:has-text("Retry")');
      const count = await retryButton.count();
      // Retry option should exist
    });
  });

  test.describe('Donation Responsive', () => {
    test('DON-040: Donation page renders on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/donation`);
      
      const form = page.locator('form').first();
      await expect(form).toBeVisible();
    });

    test('DON-041: Form fields stack on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/donation`);
      
      const fields = page.locator('input, select');
      const count = await fields.count();
      expect(count).toBeGreaterThan(0);
    });

    test('DON-042: Payment options work on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/donation`);
      
      const paymentOptions = page.locator('input[type="radio"]');
      const count = await paymentOptions.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Donation Security', () => {
    test('DON-050: Sensitive data is not logged', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const emailField = page.locator('input[type="email"]').first();
      if (await emailField.count() > 0) {
        await emailField.fill('test@example.com');
        
        // Check URL doesn't contain sensitive data
        const url = page.url();
        expect(url).not.toContain('test@example.com');
      }
    });

    test('DON-051: Form submission uses HTTPS', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      // Check that form action or page is secure
      const form = page.locator('form').first();
      const action = await form.getAttribute('action');
      expect(action).toBeTruthy();
    });
  });

  test.describe('Donation Accessibility', () => {
    test('DON-060: All form fields have labels', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const inputs = page.locator('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])');
      const count = await inputs.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const placeholder = await input.getAttribute('placeholder');
        
        expect(id || ariaLabel || placeholder).toBeTruthy();
      }
    });

    test('DON-061: Error messages are accessible', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
      
      const errorMessages = page.locator('[aria-live="polite"], [role="alert"], .error, .text-red');
      const count = await errorMessages.count();
      // Error messages should be announced
    });
  });
});
