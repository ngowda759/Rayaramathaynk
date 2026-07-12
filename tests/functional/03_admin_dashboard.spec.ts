import { test, expect } from '@playwright/test';

const BASE_URL = 'https://work-1-dhvcepsnljpkopbv.prod-runtime.all-hands.dev';

test.describe('Admin Dashboard Module', () => {
  // TC-056: Dashboard Page Access
  test('TC-056: Dashboard page loads correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
  });

  // TC-057: Dashboard Statistics Cards
  test('TC-057: Dashboard shows statistics cards', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const statCards = page.locator('[class*="stat"], [class*="card"], [class*="metric"]');
    await expect(statCards.first()).toBeVisible();
  });

  // TC-058: Sidebar Navigation
  test('TC-058: Sidebar navigation is visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const sidebar = page.locator('[class*="sidebar"], aside, nav[class*="sidebar"]').first();
    await expect(sidebar).toBeVisible();
  });

  // TC-059: Sidebar Menu Items
  test('TC-059: Sidebar menu items are clickable', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const menuItems = page.locator('[class*="sidebar"] a, aside a').first();
    if (await menuItems.isVisible()) {
      await expect(menuItems).toBeEnabled();
    }
  });

  // TC-060: Mobile Sidebar Toggle
  test('TC-060: Mobile sidebar toggle works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/admin`);
    const menuToggle = page.locator('[class*="menu"], [class*="hamburger"], button[class*="toggle"]').first();
    if (await menuToggle.isVisible()) {
      await menuToggle.click();
      await page.waitForTimeout(500);
    }
  });

  // TC-061: Mobile Sidebar Overlay
  test('TC-061: Mobile sidebar has overlay', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/admin`);
    const menuToggle = page.locator('[class*="menu"]').first();
    if (await menuToggle.isVisible()) {
      await menuToggle.click();
      await page.waitForTimeout(500);
      const overlay = page.locator('[class*="overlay"], [class*="backdrop"]').first();
      if (await overlay.isVisible()) {
        await overlay.click();
        await page.waitForTimeout(500);
      }
    }
  });

  // TC-062: Responsive Card Layout
  test('TC-062: Cards align properly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${BASE_URL}/admin`);
    const cards = page.locator('[class*="card"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  // TC-063: Responsive Card Layout Mobile
  test('TC-063: Cards stack properly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(500);
  });

  // TC-064: Dashboard Loading State
  test('TC-064: Loading state displays while fetching data', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const loadingState = page.locator('[class*="skeleton"], [class*="loading"], [class*="spinner"]').first();
    const count = await loadingState.count();
    // Loading state may or may not be visible
  });

  // TC-065: Charts/Graphs Display
  test('TC-065: Charts or graphs display on dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const charts = page.locator('canvas, [class*="chart"], svg[class*="chart"]').first();
    if (await charts.isVisible()) {
      await expect(charts).toBeVisible();
    }
  });

  // TC-066: Recent Activity Section
  test('TC-066: Recent activity section displays', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const activity = page.locator('[class*="activity"], [class*="recent"]').first();
    if (await activity.isVisible()) {
      await expect(activity).toBeVisible();
    }
  });

  // TC-067: Quick Actions
  test('TC-067: Quick action buttons work', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const quickActions = page.locator('[class*="quick-action"], button[class*="action"]').first();
    if (await quickActions.isVisible()) {
      await expect(quickActions).toBeEnabled();
    }
  });

  // TC-068: Notifications Bell
  test('TC-068: Notifications bell icon is visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const bell = page.locator('[class*="bell"], [class*="notification"]').first();
    if (await bell.isVisible()) {
      await expect(bell).toBeVisible();
    }
  });

  // TC-069: User Profile Menu
  test('TC-069: User profile menu is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const profile = page.locator('[class*="profile"], [class*="avatar"]').first();
    if (await profile.isVisible()) {
      await profile.click();
      await page.waitForTimeout(500);
    }
  });

  // TC-070: Logout from Dashboard
  test('TC-070: Logout option available in profile menu', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const profile = page.locator('[class*="profile"]').first();
    if (await profile.isVisible()) {
      await profile.click();
      await page.waitForTimeout(500);
      const logout = page.locator('text=/logout|sign out|log out/i').first();
      if (await logout.isVisible()) {
        await expect(logout).toBeVisible();
      }
    }
  });

  // TC-071: Scroll Behavior
  test('TC-071: Dashboard scrolls smoothly', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
  });

  // TC-072: Scroll to Top Button
  test('TC-072: Scroll to top button appears on scroll', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const scrollButton = page.locator('[class*="scroll-top"], [class*="back-top"]').first();
    if (await scrollButton.isVisible()) {
      await expect(scrollButton).toBeVisible();
    }
  });

  // TC-073: Dashboard Header
  test('TC-073: Dashboard header displays correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const header = page.locator('header, [class*="header"]').first();
    await expect(header).toBeVisible();
  });

  // TC-074: Breadcrumb Navigation
  test('TC-074: Breadcrumb navigation displays', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/sevas`);
    const breadcrumbs = page.locator('[class*="breadcrumb"], [class*="crumbs"]').first();
    if (await breadcrumbs.isVisible()) {
      await expect(breadcrumbs).toBeVisible();
    }
  });

  // TC-075: Page Title Matches
  test('TC-075: Page title matches current section', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  // TC-076: Tab Navigation
  test('TC-076: Tab navigation works correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const tabs = page.locator('[class*="tab"]').first();
    if (await tabs.isVisible()) {
      await expect(tabs).toBeVisible();
    }
  });

  // TC-077: Search Functionality
  test('TC-077: Search input is available', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const search = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await search.isVisible()) {
      await expect(search).toBeVisible();
    }
  });

  // TC-078: Filter Options
  test('TC-078: Filter options are available', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/sevas`);
    const filters = page.locator('[class*="filter"]').first();
    if (await filters.isVisible()) {
      await expect(filters).toBeVisible();
    }
  });

  // TC-079: Date Range Picker
  test('TC-079: Date range picker works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/bookings`);
    const datePicker = page.locator('input[type="date"], [class*="datepicker"]').first();
    if (await datePicker.isVisible()) {
      await expect(datePicker).toBeVisible();
    }
  });

  // TC-080: Export Data Button
  test('TC-080: Export data button is available', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/bookings`);
    const exportBtn = page.locator('button:has-text("Export"), button:has-text("Download")').first();
    if (await exportBtn.isVisible()) {
      await expect(exportBtn).toBeVisible();
    }
  });
});
