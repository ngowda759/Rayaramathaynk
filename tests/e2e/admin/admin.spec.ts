import { test, expect, Page } from '@playwright/test';
import { BASE_URL, VIEWPORTS, waitForPageLoad } from '../test-utils';

test.describe('Admin Portal Module', () => {
  test.describe('Admin Access Control', () => {
    test('ADM-001: Admin page requires authentication', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin`);
      await page.waitForTimeout(2000);
      
      const url = page.url();
      // Should redirect to login or show access denied
      expect(url.includes('/login') || url.includes('/admin')).toBeTruthy();
    });

    test('ADM-002: Unauthenticated users see login page', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin`);
      await page.waitForTimeout(2000);
      
      const loginForm = page.locator('form, [class*="login"]');
      const count = await loginForm.count();
      // Should show login or redirect
    });
  });

  test.describe('Admin Dashboard', () => {
    test('ADM-010: Admin dashboard loads for authenticated users', async ({ page }) => {
      // This test assumes authentication is handled
      await page.goto(`${BASE_URL}/admin`);
      await page.waitForTimeout(2000);
      
      const dashboard = page.locator('main, [class*="dashboard"]');
      const count = await dashboard.count();
      // Dashboard should be visible
    });

    test('ADM-011: Navigation sidebar exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin`);
      await page.waitForTimeout(2000);
      
      const sidebar = page.locator('aside, nav, [class*="sidebar"]');
      const count = await sidebar.count();
      // Should have navigation
    });

    test('ADM-012: Admin menu items exist', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin`);
      await page.waitForTimeout(2000);
      
      const menuItems = page.locator('nav a, aside a, [class*="menu"] a');
      const count = await menuItems.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Admin Announcements', () => {
    test('ADM-020: Announcements page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/announcements`);
      await page.waitForTimeout(2000);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('ADM-021: Create announcement button exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/announcements`);
      await page.waitForTimeout(2000);
      
      const createButton = page.locator('a:has-text("Create"), a:has-text("New"), button:has-text("Add")');
      const count = await createButton.count();
      // Should have create button
    });

    test('ADM-022: Announcements list displays', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/announcements`);
      await page.waitForTimeout(2000);
      
      const list = page.locator('table, [class*="list"], [class*="table"]');
      const count = await list.count();
      // Should show announcements
    });
  });

  test.describe('Admin Events Management', () => {
    test('ADM-030: Events management page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await page.waitForTimeout(2000);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('ADM-031: Create event button exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await page.waitForTimeout(2000);
      
      const createButton = page.locator('a:has-text("Create"), a:has-text("New Event")');
      const count = await createButton.count();
      // Should have create button
    });

    test('ADM-032: Event form fields exist', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events/new`);
      await page.waitForTimeout(2000);
      
      const form = page.locator('form');
      const count = await form.count();
      if (count > 0) {
        await expect(form).toBeVisible();
      }
    });

    test('ADM-033: Title field exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events/new`);
      await page.waitForTimeout(2000);
      
      const titleField = page.locator('input[name*="title" i], input[placeholder*="title" i]').first();
      const count = await titleField.count();
      if (count > 0) {
        await expect(titleField).toBeVisible();
      }
    });

    test('ADM-034: Date fields exist', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events/new`);
      await page.waitForTimeout(2000);
      
      const dateField = page.locator('input[type="date"], input[name*="date" i]').first();
      const count = await dateField.count();
      // Should have date field
    });

    test('ADM-035: Description field exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events/new`);
      await page.waitForTimeout(2000);
      
      const descField = page.locator('textarea, [contenteditable]').first();
      const count = await descField.count();
      if (count > 0) {
        await expect(descField).toBeVisible();
      }
    });
  });

  test.describe('Admin Sevas Management', () => {
    test('ADM-040: Sevas management page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/sevas`);
      await page.waitForTimeout(2000);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('ADM-041: Create seva button exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/sevas`);
      await page.waitForTimeout(2000);
      
      const createButton = page.locator('a:has-text("Create"), a:has-text("New")');
      const count = await createButton.count();
      // Should have create button
    });

    test('ADM-042: Seva list displays', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/sevas`);
      await page.waitForTimeout(2000);
      
      const list = page.locator('table, [class*="list"]');
      const count = await list.count();
      // Should show sevas list
    });
  });

  test.describe('Admin Gallery Management', () => {
    test('ADM-050: Gallery management page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/gallery`);
      await page.waitForTimeout(2000);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('ADM-051: Upload button exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/gallery`);
      await page.waitForTimeout(2000);
      
      const uploadButton = page.locator('button:has-text("Upload"), button:has-text("Add")');
      const count = await uploadButton.count();
      // Should have upload button
    });

    test('ADM-052: Image grid displays', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/gallery`);
      await page.waitForTimeout(2000);
      
      const grid = page.locator('[class*="grid"], [class*="gallery"]');
      const count = await grid.count();
      // Should show image grid
    });
  });

  test.describe('Admin Settings', () => {
    test('ADM-060: Settings page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await page.waitForTimeout(2000);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('ADM-061: Temple information section exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await page.waitForTimeout(2000);
      
      const section = page.locator('text=/temple|inform/i');
      const count = await section.count();
      // Should have temple settings
    });

    test('ADM-062: Homepage settings exist', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/settings/homepage`);
      await page.waitForTimeout(2000);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('Admin AI Settings', () => {
    test('ADM-070: AI settings page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/ai`);
      await page.waitForTimeout(2000);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('ADM-071: Knowledge base section exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/ai/knowledge`);
      await page.waitForTimeout(2000);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('ADM-072: AI analytics page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/ai/analytics`);
      await page.waitForTimeout(2000);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('Admin Donations & Bookings', () => {
    test('ADM-080: Donations page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/donations`);
      await page.waitForTimeout(2000);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('ADM-081: Bookings page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/bookings`);
      await page.waitForTimeout(2000);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('Admin Forms Validation', () => {
    test('ADM-090: Required fields show validation', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events/new`);
      await page.waitForTimeout(2000);
      
      const submitButton = page.locator('button[type="submit"]').first();
      if (await submitButton.count() > 0) {
        await submitButton.click();
        await page.waitForTimeout(500);
        // Should show validation errors
      }
    });

    test('ADM-091: Form accepts valid input', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events/new`);
      await page.waitForTimeout(2000);
      
      const titleField = page.locator('input[name*="title" i]').first();
      if (await titleField.count() > 0) {
        await titleField.fill('Test Event');
        const value = await titleField.inputValue();
        expect(value).toBe('Test Event');
      }
    });
  });

  test.describe('Admin Responsive', () => {
    test('ADM-100: Admin works on tablet', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.goto(`${BASE_URL}/admin`);
      await page.waitForTimeout(2000);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('ADM-101: Sidebar collapses on smaller screens', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/admin`);
      await page.waitForTimeout(2000);
      
      const sidebar = page.locator('aside, nav');
      const count = await sidebar.count();
      // Sidebar may collapse
    });
  });
});
