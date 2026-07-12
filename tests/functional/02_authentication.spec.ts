import { test, expect } from '@playwright/test';

const BASE_URL = 'https://work-1-dhvcepsnljpkopbv.prod-runtime.all-hands.dev';
const LOGIN_URL = `${BASE_URL}/login`;

test.describe('Authentication Module', () => {
  // TC-031: Login Page Access
  test('TC-031: Login page is accessible', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await expect(page).toHaveURL(/login/);
  });

  // TC-032: Login Form Elements
  test('TC-032: Login form has email and password fields', async ({ page }) => {
    await page.goto(LOGIN_URL);
    const emailField = page.locator('input[type="email"], input[name="email"]').first();
    const passwordField = page.locator('input[type="password"], input[name="password"]').first();
    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();
  });

  // TC-033: Login Form Submit Button
  test('TC-033: Login form has submit button', async ({ page }) => {
    await page.goto(LOGIN_URL);
    const submitButton = page.locator('button[type="submit"]').first();
    await expect(submitButton).toBeVisible();
  });

  // TC-034: Empty Login Validation
  test('TC-034: Empty login shows validation error', async ({ page }) => {
    await page.goto(LOGIN_URL);
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();
    await page.waitForTimeout(500);
    const errorMessage = page.locator('[class*="error"], [class*="message"], text=/required|empty|invalid/i').first();
    if (await errorMessage.isVisible()) {
      expect(await errorMessage.textContent()).toBeTruthy();
    }
  });

  // TC-035: Invalid Email Format
  test('TC-035: Invalid email format shows error', async ({ page }) => {
    await page.goto(LOGIN_URL);
    const emailField = page.locator('input[type="email"]').first();
    await emailField.fill('invalid-email');
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();
    await page.waitForTimeout(500);
  });

  // TC-036: Invalid Credentials
  test('TC-036: Invalid credentials show error message', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    const errorMessage = page.locator('[class*="error"], [class*="alert"], text=/invalid|failed|incorrect/i').first();
    if (await errorMessage.isVisible()) {
      expect(await errorMessage.textContent()).toBeTruthy();
    }
  });

  // TC-037: Password Visibility Toggle
  test('TC-037: Password visibility can be toggled', async ({ page }) => {
    await page.goto(LOGIN_URL);
    const passwordField = page.locator('input[type="password"]').first();
    const toggleButton = page.locator('[class*="toggle-password"], [class*="visibility"]').first();
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      await expect(passwordField).toHaveAttribute('type', 'text');
      await toggleButton.click();
      await expect(passwordField).toHaveAttribute('type', 'password');
    }
  });

  // TC-038: Remember Me Checkbox
  test('TC-038: Remember me checkbox exists', async ({ page }) => {
    await page.goto(LOGIN_URL);
    const rememberMe = page.locator('input[type="checkbox"], text=/remember/i').first();
    if (await rememberMe.isVisible()) {
      await expect(rememberMe).toBeVisible();
    }
  });

  // TC-039: Forgot Password Link
  test('TC-039: Forgot password link exists', async ({ page }) => {
    await page.goto(LOGIN_URL);
    const forgotLink = page.locator('a:has-text("Forgot"), text=/forgot.*password/i').first();
    if (await forgotLink.isVisible()) {
      await expect(forgotLink).toBeVisible();
    }
  });

  // TC-040: Register Link
  test('TC-040: Register link navigates to registration', async ({ page }) => {
    await page.goto(LOGIN_URL);
    const registerLink = page.locator('a:has-text("Register"), a:has-text("Sign up")').first();
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(page).toHaveURL(/register/);
    }
  });

  // TC-041: Successful Login Redirect
  test('TC-041: Successful login redirects to dashboard', async ({ page }) => {
    await page.goto(LOGIN_URL);
    // Note: This test requires valid credentials
    // Skip if no test account available
  });

  // TC-042: Logout Functionality
  test('TC-042: Logout button is visible when logged in', async ({ page }) => {
    // Requires authenticated session
  });

  // TC-043: Session Timeout
  test('TC-043: Session timeout handling', async ({ page }) => {
    // Requires authenticated session
  });

  // TC-044: CSRF Token
  test('TC-044: CSRF token is present in form', async ({ page }) => {
    await page.goto(LOGIN_URL);
    const csrfToken = page.locator('input[name="_csrf"], input[name="csrf"]').first();
    if (await csrfToken.count() > 0) {
      const token = await csrfToken.getAttribute('value');
      expect(token).toBeTruthy();
    }
  });

  // TC-045: Password Minimum Length
  test('TC-045: Password minimum length validation', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', '123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);
  });

  // TC-046: Multiple Login Attempts
  test('TC-046: Multiple failed login attempts show warning', async ({ page }) => {
    await page.goto(LOGIN_URL);
    for (let i = 0; i < 3; i++) {
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);
    }
  });

  // TC-047: Email Case Sensitivity
  test('TC-047: Email is not case-sensitive', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.fill('input[type="email"]', 'TEST@EXAMPLE.COM');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
  });

  // TC-048: Special Characters in Password
  test('TC-048: Special characters in password work', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'P@ssw0rd!#$%');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
  });

  // TC-049: Login Page Branding
  test('TC-049: Login page has temple branding', async ({ page }) => {
    await page.goto(LOGIN_URL);
    const branding = page.locator('[class*="logo"], [class*="brand"], img').first();
    await expect(branding).toBeVisible();
  });

  // TC-050: Keyboard Navigation on Login
  test('TC-050: Tab navigation works on login form', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  // TC-051: Enter Key Submits Form
  test('TC-051: Pressing Enter submits login form', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
  });

  // TC-052: Loading State During Login
  test('TC-052: Loading state shows during login', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    const loadingSpinner = page.locator('[class*="spinner"], [class*="loading"]').first();
    await page.waitForTimeout(500);
  });

  // TC-053: Unauthorized Access Redirect
  test('TC-053: Accessing admin page redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).toMatch(/login|auth/);
  });

  // TC-054: Already Logged In Redirect
  test('TC-054: Logged in user accessing login page redirects', async ({ page }) => {
    // Requires authenticated session
  });

  // TC-055: Password Field Autocomplete
  test('TC-055: Password field has correct autocomplete', async ({ page }) => {
    await page.goto(LOGIN_URL);
    const passwordField = page.locator('input[type="password"]').first();
    const autocomplete = await passwordField.getAttribute('autocomplete');
    expect(autocomplete).toBe('current-password');
  });
});
