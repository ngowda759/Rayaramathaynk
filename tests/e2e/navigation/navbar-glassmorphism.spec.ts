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

    for (const width of [1280, 1440, 1920]) {
      test(`NAV-DESK-CLEARANCE-${width}: Floating navbar maintains clear vertical separation at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);

        const metrics = await page.evaluate(() => {
          const header = document.querySelector('header');
          const floatingBox = header?.querySelector('div[class*="rounded-3xl"]')?.getBoundingClientRect();
          const marquee = document.querySelector('.bg-\\[\\#7A1024\\]')?.getBoundingClientRect();
          const bell = document.querySelector('.bg-\\[\\#7A1024\\] svg')?.getBoundingClientRect();

          return {
            floatingBottom: floatingBox?.bottom ?? 0,
            marqueeTop: marquee?.top ?? 0,
            bellTop: bell?.top ?? 0,
          };
        });

        // Pill bottom must be strictly above marquee top
        expect(metrics.marqueeTop).toBeGreaterThan(metrics.floatingBottom);
        // Clearance must be at least 14px
        expect(metrics.marqueeTop - metrics.floatingBottom).toBeGreaterThanOrEqual(14);
        // Bell icon must not be underneath the navbar
        expect(metrics.bellTop).toBeGreaterThan(metrics.floatingBottom + 20);
      });
    }
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

    for (const width of [1024, 1100]) {
      test(`NAV-INT-CLEARANCE-${width}: Intermediate breakpoint maintains clear vertical separation at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);

        const metrics = await page.evaluate(() => {
          const header = document.querySelector('header');
          const floatingBox = header?.querySelector('div[class*="rounded-3xl"]')?.getBoundingClientRect();
          const marquee = document.querySelector('.bg-\\[\\#7A1024\\]')?.getBoundingClientRect();
          const bell = document.querySelector('.bg-\\[\\#7A1024\\] svg')?.getBoundingClientRect();

          return {
            floatingBottom: floatingBox?.bottom ?? 0,
            marqueeTop: marquee?.top ?? 0,
            bellTop: bell?.top ?? 0,
          };
        });

        expect(metrics.marqueeTop).toBeGreaterThan(metrics.floatingBottom);
        expect(metrics.marqueeTop - metrics.floatingBottom).toBeGreaterThanOrEqual(14);
        expect(metrics.bellTop).toBeGreaterThan(metrics.floatingBottom + 20);
      });
    }
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

    for (const width of [375, 390, 430]) {
      test(`NAV-MOB-CLEARANCE-${width}: Mobile navbar maintains clear vertical separation and bell clearance at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);

        const metrics = await page.evaluate(() => {
          const header = document.querySelector('header');
          const floatingBox = header?.querySelector('div[class*="rounded-3xl"]')?.getBoundingClientRect();
          const marquee = document.querySelector('.bg-\\[\\#7A1024\\]')?.getBoundingClientRect();
          const bell = document.querySelector('.bg-\\[\\#7A1024\\] svg')?.getBoundingClientRect();

          return {
            floatingBottom: floatingBox?.bottom ?? 0,
            marqueeTop: marquee?.top ?? 0,
            bellTop: bell?.top ?? 0,
          };
        });

        // Pill bottom must be strictly above marquee top
        expect(metrics.marqueeTop).toBeGreaterThan(metrics.floatingBottom);
        // Mobile clearance must be at least 10px (measured 14px)
        expect(metrics.marqueeTop - metrics.floatingBottom).toBeGreaterThanOrEqual(10);
        // Bell icon must be below navbar with ample margin (measured ~29px)
        expect(metrics.bellTop).toBeGreaterThan(metrics.floatingBottom + 15);
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

  test.describe('Scroll Behavior & Layering', () => {
    test('NAV-SCROLL-01: Header remains sticky at top:0 and content scrolls beneath without visual collision', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);

      // Verify initial clearance before scroll
      const initialMetrics = await page.evaluate(() => {
        const header = document.querySelector('header');
        const floatingBox = header?.querySelector('div[class*="rounded-3xl"]')?.getBoundingClientRect();
        const marquee = document.querySelector('.bg-\\[\\#7A1024\\]')?.getBoundingClientRect();
        return {
          floatingBottom: floatingBox?.bottom ?? 0,
          marqueeTop: marquee?.top ?? 0,
        };
      });
      expect(initialMetrics.marqueeTop).toBeGreaterThan(initialMetrics.floatingBottom);

      // Scroll down 250px
      await page.evaluate(() => window.scrollTo(0, 250));
      await page.waitForTimeout(400);

      // Sticky header remains fixed at y = 0
      const headerBox = await page.locator('header').boundingBox();
      expect(headerBox?.y).toBe(0);

      // After scrolling past announcement bar, marquee is scrolled above viewport or behind header
      const scrolledMarqueeTop = await page.evaluate(() => {
        return document.querySelector('.bg-\\[\\#7A1024\\]')?.getBoundingClientRect().top ?? 0;
      });
      expect(scrolledMarqueeTop).toBeLessThan(0);
    });
  });
});
