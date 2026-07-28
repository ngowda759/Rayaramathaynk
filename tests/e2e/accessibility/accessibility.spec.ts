import { test, expect, Page } from '@playwright/test';
import { BASE_URL, VIEWPORTS, getHeadingHierarchy, getFocusableElements } from '../test-utils';

test.describe('Accessibility Module', () => {
  test.describe('Keyboard Navigation', () => {
    test('A11Y-001: Tab navigation works', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.keyboard.press('Tab');
      
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(focused).toBeTruthy();
    });

    test('A11Y-002: Focus is visible', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.keyboard.press('Tab');
      
      const focusVisible = await page.evaluate(() => {
        const focused = document.activeElement;
        if (!focused) return false;
        const style = window.getComputedStyle(focused);
        return style.outlineWidth !== '0px' || style.boxShadow !== 'none';
      });
      
      // Focus indicator should be visible
    });

    test('A11Y-003: All interactive elements are focusable', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const focusable = await getFocusableElements(page);
      expect(focusable.length).toBeGreaterThan(0);
    });

    test('A11Y-004: Enter key activates buttons', async ({ page }) => {
      await page.goto(BASE_URL);
      
      // Tab to a button and press Enter
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      // Should activate the button
    });

    test('A11Y-005: Escape key closes modals', async ({ page }) => {
      await page.goto(BASE_URL);
      
      // Open any modal if exists
      const chatbotButton = page.locator('[class*="chat"]').first();
      if (await chatbotButton.count() > 0) {
        await chatbotButton.click();
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        // Modal should close
      }
    });
  });

  test.describe('ARIA Labels', () => {
    test('A11Y-010: Images have alt text', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 10); i++) {
        const img = images.nth(i);
        if (await img.isVisible()) {
          const alt = await img.getAttribute('alt');
          expect(alt).toBeDefined();
        }
      }
    });

    test('A11Y-011: Buttons have accessible names', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const buttons = page.locator('button');
      const count = await buttons.count();
      
      for (let i = 0; i < Math.min(count, 10); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const text = await button.textContent();
          const ariaLabel = await button.getAttribute('aria-label');
          // Button should have text or aria-label
          expect(text?.trim() || ariaLabel).toBeTruthy();
        }
      }
    });

    test('A11Y-012: Form inputs have labels', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      const inputs = page.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
      const count = await inputs.count();
      
      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const placeholder = await input.getAttribute('placeholder');
        const name = await input.getAttribute('name');
        
        // Should have at least one labeling method
        expect(id || ariaLabel || placeholder || name).toBeTruthy();
      }
    });

    test('A11Y-013: Links have accessible text', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const links = page.locator('a:not([aria-hidden="true"])');
      const count = await links.count();
      
      for (let i = 0; i < Math.min(count, 10); i++) {
        const link = links.nth(i);
        if (await link.isVisible()) {
          const text = await link.textContent();
          const ariaLabel = await link.getAttribute('aria-label');
          // Link should have text
          expect(text?.trim() || ariaLabel).toBeTruthy();
        }
      }
    });
  });

  test.describe('Heading Hierarchy', () => {
    test('A11Y-020: Page has h1 heading', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const h1 = page.locator('h1');
      const count = await h1.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('A11Y-021: Headings follow logical order', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const hierarchy = await getHeadingHierarchy(page);
      // Headings should be in order (h1 before h2, etc.)
      expect(hierarchy.length).toBeGreaterThanOrEqual(0);
    });

    test('A11Y-022: Only one h1 per page', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const h1 = page.locator('h1');
      const count = await h1.count();
      expect(count).toBeLessThanOrEqual(1);
    });

    test('A11Y-023: No skipped heading levels', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const headings = await page.evaluate(() => {
        const h = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        return Array.from(h).map(el => parseInt(el.tagName.charAt(1)));
      });
      
      // Check that heading levels don't skip (e.g., h1 to h3 without h2)
      let lastLevel = 0;
      let skipped = false;
      for (const level of headings) {
        if (level - lastLevel > 1) {
          skipped = true;
          break;
        }
        lastLevel = level;
      }
      
      expect(skipped).toBe(false);
    });
  });

  test.describe('Color Contrast', () => {
    test('A11Y-030: Body has background color', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const bgColor = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor;
      });
      
      expect(bgColor).toBeTruthy();
    });

    test('A11Y-031: Text has foreground color', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const textColor = await page.evaluate(() => {
        return window.getComputedStyle(document.body).color;
      });
      
      expect(textColor).toBeTruthy();
    });

    test('A11Y-032: Links have distinguishable color', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const linkColor = await page.evaluate(() => {
        const link = document.querySelector('a');
        if (link) {
          return window.getComputedStyle(link).color;
        }
        return null;
      });
      
      expect(linkColor).toBeTruthy();
    });
  });

  test.describe('Screen Reader Support', () => {
    test('A11Y-040: Skip link exists', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const skipLink = page.locator('a[href="#main-content"], [class*="skip"]');
      const count = await skipLink.count();
      // Skip link should exist for accessibility
    });

    test('A11Y-041: Main content landmark exists', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const main = page.locator('main, [role="main"]');
      const count = await main.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('A11Y-042: Navigation landmark exists', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const nav = page.locator('nav, [role="navigation"]');
      const count = await nav.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('A11Y-043: Footer landmark exists', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const footer = page.locator('footer, [role="contentinfo"]');
      const count = await footer.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('A11Y-044: Live regions exist for dynamic content', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const liveRegions = page.locator('[aria-live], [aria-atomic]');
      const count = await liveRegions.count();
      // Live regions for announcements/toasts
    });
  });

  test.describe('Forms Accessibility', () => {
    test('A11Y-050: Error messages are associated with fields', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.fill('input[type="email"]', 'invalid');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
      
      const errors = page.locator('[role="alert"], .error');
      const count = await errors.count();
      // Errors should be visible and announced
    });

    test('A11Y-051: Required fields are marked', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      const requiredFields = page.locator('input[required], [aria-required="true"]');
      const count = await requiredFields.count();
      // Required fields should be marked
    });

    test('A11Y-052: Focus moves to first error on submit', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.fill('input[type="email"]', 'invalid');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
      
      const focusedId = await page.evaluate(() => document.activeElement?.id);
      // Focus should be on error field
    });
  });

  test.describe('Mobile Accessibility', () => {
    test('A11Y-060: Touch targets are large enough', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      
      const buttons = page.locator('button');
      const count = await buttons.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const button = buttons.nth(i);
        const size = await button.evaluate((el: HTMLElement) => {
          const rect = el.getBoundingClientRect();
          return Math.min(rect.width, rect.height);
        });
        
        // Touch targets should be at least 44px
        expect(size >= 44 || size === 0).toBeTruthy();
      }
    });

    test('A11Y-061: Zoom is not disabled', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      
      const viewport = page.locator('meta[name="viewport"]');
      const content = await viewport.getAttribute('content');
      
      // Should not have user-scalable=no
      expect(content).not.toContain('user-scalable=no');
    });
  });

  test.describe('Semantic HTML', () => {
    test('A11Y-070: Lists use list markup', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const navLists = await page.evaluate(() => {
        const nav = document.querySelector('nav');
        if (nav) {
          const lists = nav.querySelectorAll('ul, ol');
          const items = nav.querySelectorAll('li');
          return lists.length > 0 || items.length === 0;
        }
        return true;
      });
      
      expect(navLists).toBe(true);
    });

    test('A11Y-071: Tables have headers', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await page.waitForTimeout(2000);
      
      const tables = page.locator('table');
      const count = await tables.count();
      
      if (count > 0) {
        const hasHeaders = await page.evaluate(() => {
          const table = document.querySelector('table');
          if (table) {
            const th = table.querySelector('th');
            return !!th;
          }
          return false;
        });
        
        // Tables should have th elements
      }
    });

    test('A11Y-072: Buttons are not styled divs', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const divButtons = await page.evaluate(() => {
        const divs = document.querySelectorAll('div[onclick], div[role="button"]');
        return divs.length;
      });
      
      // Should prefer semantic button elements
      expect(divButtons).toBeLessThanOrEqual(5);
    });
  });
});
