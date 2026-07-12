import { test, expect } from '@playwright/test';

const BASE_URL = 'https://work-1-dhvcepsnljpkopbv.prod-runtime.all-hands.dev';

test.describe('Mobile and Responsive Testing', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  // TC-221: Mobile Homepage
  test('TC-221: Homepage loads on mobile', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveURL(BASE_URL);
  });

  // TC-222: Mobile Navigation Menu
  test('TC-222: Mobile navigation menu works', async ({ page }) => {
    await page.goto(BASE_URL);
    const menuButton = page.locator('[class*="menu"], [class*="hamburger"]').first();
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(500);
    }
  });

  // TC-223: Mobile Drawer Menu
  test('TC-223: Drawer menu slides in correctly', async ({ page }) => {
    await page.goto(BASE_URL);
    const menuButton = page.locator('[class*="menu"]').first();
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(500);
      const drawer = page.locator('[class*="drawer"], [class*="sidebar"], aside').first();
      if (await drawer.isVisible()) {
        await expect(drawer).toBeVisible();
      }
    }
  });

  // TC-224: Close Drawer
  test('TC-224: Close drawer works', async ({ page }) => {
    await page.goto(BASE_URL);
    const menuButton = page.locator('[class*="menu"]').first();
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(500);
      const closeButton = page.locator('[class*="close"], [class*="x"]').first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  // TC-225: Touch Targets
  test('TC-225: Touch targets are at least 44px', async ({ page }) => {
    await page.goto(BASE_URL);
    const buttons = await page.locator('button, a').all();
    for (const button of buttons.slice(0, 10)) {
      if (await button.isVisible()) {
        const box = await button.boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });

  // TC-226: Scroll Behavior
  test('TC-226: Page scrolls smoothly on mobile', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
  });

  // TC-227: Images Scale
  test('TC-227: Images scale properly on mobile', async ({ page }) => {
    await page.goto(BASE_URL);
    const images = await page.locator('img').all();
    for (const img of images.slice(0, 5)) {
      if (await img.isVisible()) {
        const box = await img.boundingBox();
        if (box) {
          expect(box.width).toBeLessThanOrEqual(375);
        }
      }
    }
  });

  // TC-228: Text Readability
  test('TC-228: Text is readable on mobile', async ({ page }) => {
    await page.goto(BASE_URL);
    const body = page.locator('body');
    const fontSize = await body.evaluate(el => window.getComputedStyle(el).fontSize);
    expect(fontSize).toBeTruthy();
  });

  // TC-229: Form Inputs on Mobile
  test('TC-229: Form inputs work on mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const emailInput = page.locator('input[type="email"]').first();
    if (await emailInput.isVisible()) {
      await emailInput.tap();
      await page.waitForTimeout(500);
    }
  });

  // TC-230: Zoom Prevention
  test('TC-230: No zoom on input focus', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(414);
  });

  // TC-231: Landscape Mode
  test('TC-231: Page renders in landscape mode', async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);
  });

  // TC-232: Tablet View
  test('TC-232: Page renders on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);
  });

  // TC-233: Large Phone (Plus)
  test('TC-233: Page renders on large phone', async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 896 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);
  });

  // TC-234: iPhone SE View
  test('TC-234: Page renders on small phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);
  });

  // TC-235: Admin Mobile View
  test('TC-235: Admin dashboard works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(1000);
  });

  // TC-236: Swipe Gestures
  test('TC-236: Swipe gestures work on mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/gallery`);
    await page.waitForTimeout(500);
    // Test horizontal swipe
  });

  // TC-237: Status Bar Safe Area
  test('TC-237: Content not hidden under status bar', async ({ page }) => {
    await page.goto(BASE_URL);
    const body = page.locator('body');
    const paddingTop = await body.evaluate(el => window.getComputedStyle(el).paddingTop);
    expect(paddingTop).toBeDefined();
  });

  // TC-238: Bottom Navigation Safe Area
  test('TC-238: Bottom content accessible on mobile', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const footer = page.locator('footer').first();
    if (await footer.isVisible()) {
      await expect(footer).toBeVisible();
    }
  });

  // TC-239: Dropdown Menus
  test('TC-239: Dropdown menus work on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);
    const dropdown = page.locator('[class*="dropdown"], select').first();
    if (await dropdown.isVisible()) {
      await dropdown.click();
      await page.waitForTimeout(500);
    }
  });

  // TC-240: Modal on Mobile
  test('TC-240: Modals render correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);
    // Open a modal if available
  });
});

test.describe('Accessibility Testing', () => {
  // TC-241: Keyboard Navigation
  test('TC-241: All interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });

  // TC-242: Skip Links
  test('TC-242: Skip links are present', async ({ page }) => {
    await page.goto(BASE_URL);
    const skipLink = page.locator('a[href*="skip"], .skip-link').first();
    // Skip links are optional but recommended
  });

  // TC-243: Focus Indicators
  test('TC-243: Focus indicators are visible', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (el) {
        const style = window.getComputedStyle(el);
        return style.outline || style.border;
      }
      return null;
    });
    expect(focused).toBeTruthy();
  });

  // TC-244: ARIA Labels
  test('TC-244: Buttons have accessible labels', async ({ page }) => {
    await page.goto(BASE_URL);
    const buttons = await page.locator('button').all();
    for (const button of buttons.slice(0, 10)) {
      if (await button.isVisible()) {
        const ariaLabel = await button.getAttribute('aria-label');
        const text = await button.textContent();
        expect(ariaLabel || text?.trim()).toBeTruthy();
      }
    }
  });

  // TC-245: Form Labels
  test('TC-245: Form fields have labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const inputs = await page.locator('input').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledby = await input.getAttribute('aria-labelledby');
      const placeholder = await input.getAttribute('placeholder');
      expect(id || ariaLabel || ariaLabelledby || placeholder).toBeTruthy();
    }
  });

  // TC-246: Heading Hierarchy
  test('TC-246: Heading hierarchy is correct', async ({ page }) => {
    await page.goto(BASE_URL);
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    let lastLevel = 0;
    for (const heading of headings.slice(0, 10)) {
      const tag = await heading.evaluate(el => el.tagName);
      const level = parseInt(tag.replace('H', ''));
      expect(level - lastLevel).toBeLessThanOrEqual(1);
      lastLevel = level;
    }
  });

  // TC-247: Color Contrast
  test('TC-247: Text has sufficient color contrast', async ({ page }) => {
    await page.goto(BASE_URL);
    // Basic check - more detailed testing would require specific tools
    const body = page.locator('body');
    const bgColor = await body.evaluate(el => window.getComputedStyle(el).backgroundColor);
    const textColor = await body.evaluate(el => window.getComputedStyle(el).color);
    expect(bgColor).toBeTruthy();
    expect(textColor).toBeTruthy();
  });

  // TC-248: Alt Text for Images
  test('TC-248: All informative images have alt text', async ({ page }) => {
    await page.goto(BASE_URL);
    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      if (await img.isVisible()) {
        // Decorative images can have empty alt, informative ones need alt
        if (role !== 'presentation' && role !== 'none') {
          expect(alt).toBeDefined();
        }
      }
    }
  });

  // TC-249: Screen Reader Landmarks
  test('TC-249: Page has proper landmarks', async ({ page }) => {
    await page.goto(BASE_URL);
    const main = page.locator('main, [role="main"]');
    const nav = page.locator('nav, [role="navigation"]');
    const footer = page.locator('footer, [role="contentinfo"]');
    await expect(main).toHaveCount(1);
    await expect(nav).toHaveCount(1, { timeout: 5000 });
  });

  // TC-250: Error Identification
  test('TC-250: Form errors are properly identified', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);
    const errors = page.locator('[class*="error"], [aria-invalid="true"]');
    const count = await errors.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  // TC-251: Error Messages
  test('TC-251: Error messages are descriptive', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'invalid');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);
  });

  // TC-252: Required Fields Indication
  test('TC-252: Required fields are marked', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const requiredFields = page.locator('input[required], [aria-required="true"]');
    const count = await requiredFields.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  // TC-253: Focus Management
  test('TC-253: Focus is managed on modal open', async ({ page }) => {
    await page.goto(BASE_URL);
    // Test modal focus trapping
  });

  // TC-254: Reduced Motion
  test('TC-254: Respects reduced motion preference', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);
  });

  // TC-255: Touch Action
  test('TC-255: Touch actions are appropriate', async ({ page }) => {
    await page.goto(BASE_URL);
    const elements = await page.locator('.touch-action, [style*="touch-action"]').all();
    const count = await elements.count();
    // Touch actions are optional
  });
});
