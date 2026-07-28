import { Page, Locator, expect, FullConfig } from '@playwright/test';
import { BASE_URL, waitForPageLoad } from '../test-utils';

// Test credentials (use environment variables in CI)
export const TEST_USERS = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@test.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'TestAdmin123!',
  },
  devotee: {
    email: process.env.TEST_DEVOTEE_EMAIL || 'devotee@test.com',
    password: process.env.TEST_DEVOTEE_PASSWORD || 'TestDevotee123!',
  },
  volunteer: {
    email: process.env.TEST_VOLUNTEER_EMAIL || 'volunteer@test.com',
    password: process.env.TEST_VOLUNTEER_PASSWORD || 'TestVolunteer123!',
  },
};

// Storage state for authenticated sessions
export const AUTH_STORAGE_PATH = 'tests/e2e/sprint3/.auth';

/**
 * Login helper that handles the login flow
 */
export async function login(
  page: Page,
  credentials: { email: string; password: string }
): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await waitForPageLoad(page);
  
  // Fill in login form
  const emailInput = page.locator('input[type="email"], input[name*="email" i]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  
  await emailInput.fill(credentials.email);
  await passwordInput.fill(credentials.password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for redirect or error
  await page.waitForTimeout(2000);
}

/**
 * Logout helper
 */
export async function logout(page: Page): Promise<void> {
  // Try to find logout button in navbar or user menu
  const logoutSelectors = [
    'button:has-text("Logout")',
    'button:has-text("Log out")',
    'a:has-text("Logout")',
    'a:has-text("Log out")',
    '[data-testid="logout"]',
    '[aria-label="Logout"]',
  ];
  
  for (const selector of logoutSelectors) {
    const element = page.locator(selector).first();
    if (await element.count() > 0) {
      await element.click();
      await waitForPageLoad(page);
      return;
    }
  }
  
  // Fallback: clear storage
  await page.context().clearCookies();
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Check for user-specific elements
  const userElements = page.locator('[data-testid="user-menu"], .user-menu, [aria-label="User menu"]');
  return (await userElements.count()) > 0;
}

/**
 * Get current user role from the page
 */
export async function getCurrentUserRole(page: Page): Promise<string | null> {
  const roleElement = page.locator('[data-testid="user-role"], .user-role, [data-role]').first();
  if (await roleElement.count() > 0) {
    return await roleElement.textContent();
  }
  return null;
}

/**
 * Navigate to admin page and verify access
 */
export async function navigateToAdminPage(page: Page, path: string): Promise<boolean> {
  await page.goto(`${BASE_URL}/admin${path}`);
  await page.waitForLoadState('domcontentloaded');
  
  // Check if redirected to login (no access)
  if (page.url().includes('/login')) {
    return false;
  }
  
  // Check for access denied message
  const accessDenied = page.locator('text=/access denied|unauthorized|forbidden/i');
  if (await accessDenied.count() > 0) {
    return false;
  }
  
  return true;
}

/**
 * Create authenticated storage state for reuse
 */
export async function createAuthStorageState(
  browser: import('@playwright/test').Browser,
  credentials: { email: string; password: string },
  storagePath: string
): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    await login(page, credentials);
    await page.waitForTimeout(1000);
    await context.storageState({ path: storagePath });
  } finally {
    await context.close();
  }
}

/**
 * Protected routes that require authentication
 */
export const PROTECTED_ROUTES = [
  '/profile',
  '/profile/settings',
  '/profile/preferences',
  '/favorites',
  '/notifications',
  '/admin',
  '/admin/events',
  '/admin/donations',
  '/admin/users',
  '/admin/settings',
];

/**
 * Admin-only routes that require admin role
 */
export const ADMIN_ONLY_ROUTES = [
  '/admin/users',
  '/admin/settings',
  '/admin/finance',
  '/admin/billing',
];

/**
 * Test helper to verify redirect to login for protected routes
 */
export async function verifyProtectedRouteRedirect(page: Page, route: string): Promise<void> {
  await page.goto(`${BASE_URL}${route}`);
  await page.waitForLoadState('domcontentloaded');
  
  // Should redirect to login
  expect(page.url()).toContain('/login');
}

/**
 * Test helper to verify admin-only access
 */
export async function verifyAdminOnlyAccess(
  page: Page,
  route: string,
  userRole: 'admin' | 'devotee' | 'volunteer'
): Promise<void> {
  const hasAccess = await navigateToAdminPage(page, route);
  
  if (userRole === 'admin') {
    expect(hasAccess).toBe(true);
  } else {
    // Non-admin users should be redirected or see access denied
    expect(hasAccess).toBe(false);
  }
}
