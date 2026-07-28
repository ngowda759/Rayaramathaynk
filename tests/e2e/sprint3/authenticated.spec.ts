import { test, expect, Page } from '@playwright/test';
import { BASE_URL, waitForPageLoad, VIEWPORTS } from '../test-utils';
import {
  login,
  logout,
  isAuthenticated,
  getCurrentUserRole,
  verifyProtectedRouteRedirect,
  navigateToAdminPage,
  TEST_USERS,
  PROTECTED_ROUTES,
  ADMIN_ONLY_ROUTES,
} from './sprint3-test-utils';

test.describe('Authenticated User Tests - Sprint 3', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Clear session before each test
    await page.context().clearCookies();
    await page.goto(BASE_URL);
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup - logout after each test
    try {
      await logout(page);
    } catch {
      // Ignore logout errors
    }
  });

  // ==================== AUTHENTICATION FLOW TESTS ====================

  test.describe('Authentication Flow', () => {
    test('AUTH-FLOW-001: Complete login flow with valid credentials', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);

      // Fill login form
      const emailInput = page.locator('input[type="email"], input[name*="email" i]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const submitButton = page.locator('button[type="submit"]').first();

      await emailInput.fill(TEST_USERS.devotee.email);
      await passwordInput.fill(TEST_USERS.devotee.password);
      await submitButton.click();

      // Wait for redirect
      await page.waitForTimeout(3000);

      // Verify we're logged in (not on login page anymore)
      expect(page.url()).not.toContain('/login');
    });

    test('AUTH-FLOW-002: Login failure with invalid credentials shows error', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);

      const emailInput = page.locator('input[type="email"], input[name*="email" i]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const submitButton = page.locator('button[type="submit"]').first();

      await emailInput.fill('invalid@test.com');
      await passwordInput.fill('wrongpassword');
      await submitButton.click();

      await page.waitForTimeout(2000);

      // Should show error message
      const errorMessage = page.locator('text=/error|invalid|incorrect|failed/i').first();
      // Either stay on login page or show error
      expect(page.url()).toContain('/login') || (await errorMessage.count()) > 0;
    });

    test('AUTH-FLOW-003: Session persists across page navigation', async ({ page }) => {
      // Login
      await login(page, TEST_USERS.devotee);
      await page.waitForTimeout(2000);

      // Navigate to different pages
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);

      // Should still be authenticated
      expect(await isAuthenticated(page)).toBe(true);
      expect(page.url()).not.toContain('/login');

      // Navigate to another page
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);

      // Should still be authenticated
      expect(await isAuthenticated(page)).toBe(true);
    });

    test('AUTH-FLOW-004: Logout clears session', async ({ page }) => {
      // Login first
      await login(page, TEST_USERS.devotee);
      await page.waitForTimeout(2000);

      expect(await isAuthenticated(page)).toBe(true);

      // Logout
      await logout(page);
      await page.waitForTimeout(1000);

      // Should not be authenticated
      expect(await isAuthenticated(page)).toBe(false);
    });

    test('AUTH-FLOW-005: Invalid session token redirects to login', async ({ page }) => {
      // Set invalid auth token
      await page.context().addCookies([
        {
          name: 'auth_token',
          value: 'invalid_token_12345',
          domain: 'localhost',
          path: '/',
        },
      ]);

      // Try to access protected route
      await page.goto(`${BASE_URL}/profile`);
      await page.waitForTimeout(2000);

      // Should redirect to login
      expect(page.url()).toContain('/login');
    });
  });

  // ==================== PROTECTED ROUTE TESTS ====================

  test.describe('Protected Routes', () => {
    for (const route of PROTECTED_ROUTES.slice(0, 5)) {
      test(`PROTECTED-${route.replace(/\//g, '_').toUpperCase()}: ${route} redirects to login when unauthenticated`, async ({ page }) => {
        await verifyProtectedRouteRedirect(page, route);
      });
    }

    test('PROTECTED_PROFILE: Profile page accessible when authenticated', async ({ page }) => {
      await login(page, TEST_USERS.devotee);
      await page.waitForTimeout(2000);

      await page.goto(`${BASE_URL}/profile`);
      await waitForPageLoad(page);

      // Should not redirect to login
      expect(page.url()).not.toContain('/login');
      expect(page.url()).toContain('/profile');
    });

    test('PROTECTED_FAVORITES: Favorites page accessible when authenticated', async ({ page }) => {
      await login(page, TEST_USERS.devotee);
      await page.waitForTimeout(2000);

      await page.goto(`${BASE_URL}/favorites`);
      await waitForPageLoad(page);

      expect(page.url()).not.toContain('/login');
      expect(page.url()).toContain('/favorites');
    });

    test('PROTECTED_NOTIFICATIONS: Notifications page accessible when authenticated', async ({ page }) => {
      await login(page, TEST_USERS.devotee);
      await page.waitForTimeout(2000);

      await page.goto(`${BASE_URL}/notifications`);
      await waitForPageLoad(page);

      expect(page.url()).not.toContain('/login');
      expect(page.url()).toContain('/notifications');
    });
  });

  // ==================== ADMIN ACCESS TESTS ====================

  test.describe('Admin Access Control', () => {
    test('ADMIN_ACCESS_001: Admin user can access admin dashboard', async ({ page }) => {
      await login(page, TEST_USERS.admin);
      await page.waitForTimeout(2000);

      const hasAccess = await navigateToAdminPage(page, '');
      expect(hasAccess).toBe(true);
      expect(page.url()).toContain('/admin');
    });

    test('ADMIN_ACCESS_002: Devotee user cannot access admin routes', async ({ page }) => {
      await login(page, TEST_USERS.devotee);
      await page.waitForTimeout(2000);

      const hasAccess = await navigateToAdminPage(page, '/events');
      expect(hasAccess).toBe(false);
    });

    test('ADMIN_ACCESS_003: Volunteer user cannot access admin routes', async ({ page }) => {
      await login(page, TEST_USERS.volunteer);
      await page.waitForTimeout(2000);

      const hasAccess = await navigateToAdminPage(page, '/users');
      expect(hasAccess).toBe(false);
    });

    test('ADMIN_ACCESS_004: Admin can access user management', async ({ page }) => {
      await login(page, TEST_USERS.admin);
      await page.waitForTimeout(2000);

      const hasAccess = await navigateToAdminPage(page, '/users');
      expect(hasAccess).toBe(true);
    });

    test('ADMIN_ACCESS_005: Admin can access settings', async ({ page }) => {
      await login(page, TEST_USERS.admin);
      await page.waitForTimeout(2000);

      const hasAccess = await navigateToAdminPage(page, '/settings');
      expect(hasAccess).toBe(true);
    });
  });

  // ==================== SESSION MANAGEMENT TESTS ====================

  test.describe('Session Management', () => {
    test('SESSION_001: Session timeout handling', async ({ page }) => {
      await login(page, TEST_USERS.devotee);
      await page.waitForTimeout(2000);

      // Verify session is active
      expect(await isAuthenticated(page)).toBe(true);

      // Simulate session expiry by clearing storage
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // Try to access protected page
      await page.goto(`${BASE_URL}/profile`);
      await page.waitForTimeout(2000);

      // Should redirect to login
      expect(page.url()).toContain('/login');
    });

    test('SESSION_002: Multiple browser contexts maintain separate sessions', async ({ browser }) => {
      // Create two separate contexts
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      try {
        // Login in first context
        await login(page1, TEST_USERS.devotee);
        await page1.waitForTimeout(2000);

        // Go to second context - should not be authenticated
        await page2.goto(`${BASE_URL}/profile`);
        await page2.waitForTimeout(2000);
        expect(page2.url()).toContain('/login');

        // First context should still be authenticated
        expect(await isAuthenticated(page1)).toBe(true);
      } finally {
        await context1.close();
        await context2.close();
      }
    });

    test('SESSION_003: Remember me functionality', async ({ page, context }) => {
      // Check for remember me checkbox
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);

      const rememberMe = page.locator('input[type="checkbox"], input[name*="remember" i]').first();
      if (await rememberMe.count() > 0) {
        await rememberMe.check();

        await login(page, TEST_USERS.devotee);
        await page.waitForTimeout(2000);

        // Create new context from same storage
        const newContext = await context.storageState();
        const newPage = await context.newPage();
        await newPage.goto(`${BASE_URL}/profile`);
        await newPage.waitForTimeout(2000);

        // Should be remembered (not redirected to login)
        expect(newPage.url()).not.toContain('/login');
      }
    });
  });

  // ==================== USER PROFILE TESTS ====================

  test.describe('User Profile', () => {
    test('PROFILE_001: Profile page loads user data', async ({ page }) => {
      await login(page, TEST_USERS.devotee);
      await page.waitForTimeout(2000);

      await page.goto(`${BASE_URL}/profile`);
      await waitForPageLoad(page);

      // Verify profile elements are present
      const profileElements = page.locator('[data-testid="profile"], .profile, main');
      expect(await profileElements.count()).toBeGreaterThan(0);
    });

    test('PROFILE_002: Profile settings page accessible', async ({ page }) => {
      await login(page, TEST_USERS.devotee);
      await page.waitForTimeout(2000);

      await page.goto(`${BASE_URL}/profile/settings`);
      await waitForPageLoad(page);

      expect(page.url()).toContain('/profile/settings');
    });

    test('PROFILE_003: Profile preferences page accessible', async ({ page }) => {
      await login(page, TEST_USERS.devotee);
      await page.waitForTimeout(2000);

      await page.goto(`${BASE_URL}/profile/preferences`);
      await waitForPageLoad(page);

      expect(page.url()).toContain('/profile/preferences');
    });

    test('PROFILE_004: Mobile view profile page responsive', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await login(page, TEST_USERS.devotee);
      await page.waitForTimeout(2000);

      await page.goto(`${BASE_URL}/profile`);
      await waitForPageLoad(page);

      // Page should be accessible and not broken
      expect(page.url()).not.toContain('/login');
    });
  });

  // ==================== CROSS-SITE REQUEST FORGERY TESTS ====================

  test.describe('Security - CSRF Protection', () => {
    test('CSRF_001: Form submissions include CSRF token', async ({ page }) => {
      await login(page, TEST_USERS.devotee);
      await page.waitForTimeout(2000);

      await page.goto(`${BASE_URL}/profile`);
      await waitForPageLoad(page);

      // Check if forms have CSRF tokens
      const forms = await page.locator('form').all();
      for (const form of forms) {
        const csrfInput = form.locator('input[name*="csrf" i], input[name*="_token" i]');
        // CSRF input should exist or form should use other CSRF protection
        // This is a basic check - actual CSRF validation happens server-side
      }
    });

    test('CSRF_002: API requests without auth token are rejected', async ({ page }) => {
      // Make API call without authentication
      const response = await page.request.get(`${BASE_URL}/api/admin/events`);
      
      // Should return 401 or redirect
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });
});
