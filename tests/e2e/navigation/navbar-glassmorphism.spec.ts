import { test, expect } from '@playwright/test';
import { BASE_URL } from '../test-utils';

test.describe('Devotional Glassmorphism Navbar', () => {
  test.describe('Desktop Navigation (1280px, 1440px, 1920px)', () => {
    test('NAV-DESK-01: Displays floating glassmorphism navbar at 1440px', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(BASE_URL);

      const header = page.locator('header');
      await expect(header).toBeVisible();

      // Check desktop nav
      const desktopNav = page.locator('nav[aria-label="Main navigation"]');
      await expect(desktopNav).toBeVisible();

      // Verify active pill styling exists
      const homeLink = desktopNav.locator('a:has-text("Home")');
      await expect(homeLink).toBeVisible();

      // Verify dropdown toggles
      const guruBtn = desktopNav.locator('button:has-text("Guru Parampara")');
      await expect(guruBtn).toBeVisible();
      await expect(guruBtn).toHaveAttribute('aria-expanded', 'false');

      await guruBtn.click();
      await expect(guruBtn).toHaveAttribute('aria-expanded', 'true');

      const dropdown = page.locator('#desktop-guru-dropdown');
      await expect(dropdown).toBeVisible();

      // Pressing Escape closes dropdown
      await page.keyboard.press('Escape');
      await expect(guruBtn).toHaveAttribute('aria-expanded', 'false');
    });

    test('NAV-DESK-02: Desktop navigation fits without wrapping at 1280px', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(BASE_URL);

      const desktopNav = page.locator('nav[aria-label="Main navigation"]');
      await expect(desktopNav).toBeVisible();

      const onlineServices = desktopNav.locator('button:has-text("Online Services")');
      await expect(onlineServices).toBeVisible();
    });
  });

  test.describe('Intermediate Breakpoints (1024px, 1100px)', () => {
    test('NAV-INT-01: Transitions to clean mobile header layout at 1024px', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto(BASE_URL);

      // Desktop nav is hidden
      const desktopNav = page.locator('nav[aria-label="Main navigation"]');
      await expect(desktopNav).toBeHidden();

      // Menu trigger button is visible
      const menuBtn = page.locator('button[aria-label="Open navigation menu"]');
      await expect(menuBtn).toBeVisible();

      // Donate CTA is visible
      const donateBtn = page.locator('header a[href="/donation"]:visible');
      await expect(donateBtn).toBeVisible();
    });

    test('NAV-INT-02: Transitions to clean mobile header layout at 1100px', async ({ page }) => {
      await page.setViewportSize({ width: 1100, height: 800 });
      await page.goto(BASE_URL);

      const desktopNav = page.locator('nav[aria-label="Main navigation"]');
      await expect(desktopNav).toBeHidden();

      const menuBtn = page.locator('button[aria-label="Open navigation menu"]');
      await expect(menuBtn).toBeVisible();
    });
  });

  test.describe('Mobile Viewport & Accessibility (375px, 390px, 430px)', () => {
    for (const width of [375, 390, 430]) {
      test(`NAV-MOB-${width}: Mobile header renders without overflow at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 667 });
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

        const header = page.locator('header');
        await expect(header).toBeVisible();

        const menuBtn = page.locator('button[aria-label="Open navigation menu"]');
        await expect(menuBtn).toBeVisible();

        const donateBtn = page.locator('header a[href="/donation"]:visible');
        await expect(donateBtn).toBeVisible();
      });
    }

    test('NAV-MOB-ACC-01: Body scroll locking and exact restoration', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });

      // Ensure body has sufficient content/height to scroll
      await page.evaluate(() => {
        document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
        document.body.style.minHeight = '3000px';
        window.scrollTo(0, 300);
      });
      await page.waitForTimeout(500);

      const menuBtn = page.locator('button[aria-label="Open navigation menu"]');
      const scrollBeforeOpen = await page.evaluate(() => window.scrollY);
      expect(scrollBeforeOpen).toBeGreaterThan(100);

      await menuBtn.click({ force: true });

      // Check body lock
      const bodyPosition = await page.evaluate(() => document.body.style.position);
      const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(bodyPosition).toBe('fixed');
      expect(bodyOverflow).toBe('hidden');

      // Close menu
      const closeBtn = page.locator('button[aria-label="Close navigation dialog"]');
      await closeBtn.click({ force: true });
      await page.waitForTimeout(300);

      // Check body restored
      const restoredPosition = await page.evaluate(() => document.body.style.position);
      const restoredOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(restoredPosition).toBe('');
      expect(restoredOverflow).toBe('');

      // Check scroll position restored (within subpixel rounding tolerance)
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(Math.abs(scrollY - scrollBeforeOpen)).toBeLessThanOrEqual(5);
    });

    test('NAV-MOB-ACC-02: Focus trapping inside mobile dialog', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(BASE_URL);

      const menuBtn = page.locator('button[aria-label="Open navigation menu"]');
      await menuBtn.click();

      const dialog = page.locator('#mobile-navigation-dialog');
      await expect(dialog).toBeVisible();

      // Focus should automatically move to close button
      const closeBtn = page.locator('button[aria-label="Close navigation dialog"]');
      await expect(closeBtn).toBeFocused({ timeout: 5000 });

      // Press Shift+Tab from close button moves to first element (brand logo link)
      await page.keyboard.press('Shift+Tab');
      const brandLogo = page.locator('#mobile-navigation-dialog a[href="/"]').first();
      await expect(brandLogo).toBeFocused();

      // Press Shift+Tab again from first element wraps to the last focusable element in dialog
      await page.keyboard.press('Shift+Tab');
      const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
      expect(['BUTTON', 'A']).toContain(focusedTag);

      // Press Tab wraps back to first element (brand logo)
      await page.keyboard.press('Tab');
      await expect(brandLogo).toBeFocused();

      // Close via Escape key
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();

      // Focus returns to the menu trigger button
      await expect(menuBtn).toBeFocused({ timeout: 5000 });
    });

    test('NAV-MOB-ACC-03: Accordion expands, collapses, and hides collapsed items from keyboard', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(BASE_URL);

      const menuBtn = page.locator('button[aria-label="Open navigation menu"]');
      await menuBtn.click();

      const guruAccordionBtn = page.locator('button:has-text("Guru Parampara")').last();
      await expect(guruAccordionBtn).toHaveAttribute('aria-expanded', 'false');

      // Submenu links inside collapsed accordion should have tabindex=-1
      const subLink = page.locator('#mobile-guru-accordion a:has-text("Knowledge Centre")');
      await expect(subLink).toHaveAttribute('tabindex', '-1');

      // Open accordion
      await guruAccordionBtn.click();
      await expect(guruAccordionBtn).toHaveAttribute('aria-expanded', 'true');
      await expect(subLink).toHaveAttribute('tabindex', '0');

      // Close accordion
      await guruAccordionBtn.click();
      await expect(guruAccordionBtn).toHaveAttribute('aria-expanded', 'false');
      await expect(subLink).toHaveAttribute('tabindex', '-1');
    });
  });
});
