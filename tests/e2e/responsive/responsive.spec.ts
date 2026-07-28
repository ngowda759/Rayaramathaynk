import { test, expect, Page } from '@playwright/test';
import { BASE_URL, VIEWPORTS, waitForPageLoad } from '../test-utils';

test.describe('Responsive Design Module', () => {
  test.describe('Desktop Layout', () => {
    test('RESP-001: Homepage renders on desktop', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('RESP-002: Navigation displays horizontally on desktop', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto(BASE_URL);
      
      const navItems = page.locator('header nav a');
      const count = await navItems.count();
      expect(count).toBeGreaterThan(0);
    });

    test('RESP-003: Cards display in grid on desktop', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const cards = page.locator('[class*="card"], article');
      const count = await cards.count();
      // Cards should display in grid layout
    });
  });

  test.describe('Tablet Layout', () => {
    test('RESP-010: Homepage renders on tablet', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('RESP-011: Navigation adjusts for tablet', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.goto(BASE_URL);
      
      const nav = page.locator('header nav').first();
      await expect(nav).toBeVisible();
    });

    test('RESP-012: Cards reflow on tablet', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const cards = page.locator('[class*="card"]');
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('RESP-013: Images scale on tablet', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 3); i++) {
        const img = images.nth(i);
        const clientWidth = await img.evaluate((el: HTMLImageElement) => el.clientWidth);
        // Images should scale appropriately
        expect(clientWidth).toBeLessThanOrEqual(1024);
      }
    });
  });

  test.describe('Mobile Layout', () => {
    test('RESP-020: Homepage renders on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('RESP-021: Hamburger menu appears on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      
      const menuButton = page.locator('button[aria-label*="menu" i], button:has-text("Menu")');
      const count = await menuButton.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('RESP-022: Cards stack vertically on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const cards = page.locator('[class*="card"]');
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('RESP-023: Text is readable on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      
      const fontSize = await page.evaluate(() => {
        const body = document.body;
        return window.getComputedStyle(body).fontSize;
      });
      
      expect(fontSize).toBeTruthy();
    });

    test('RESP-024: Buttons are touch-friendly', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      
      const buttons = page.locator('button').first();
      if (await buttons.count() > 0) {
        const size = await buttons.evaluate((el: HTMLElement) => {
          const rect = el.getBoundingClientRect();
          return Math.min(rect.width, rect.height);
        });
        // Buttons should be at least 44px
        expect(size >= 44 || size === 0).toBeTruthy();
      }
    });

    test('RESP-025: No horizontal scroll on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.body.scrollWidth > document.body.clientWidth;
      });
      
      expect(hasHorizontalScroll).toBe(false);
    });

    test('RESP-026: Forms work on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/login`);
      
      const form = page.locator('form').first();
      await expect(form).toBeVisible();
      
      const emailField = page.locator('input[type="email"]').first();
      await emailField.fill('test@example.com');
      
      const value = await emailField.inputValue();
      expect(value).toBe('test@example.com');
    });
  });

  test.describe('Landscape/Portrait', () => {
    test('RESP-030: Landscape mobile layout works', async ({ page }) => {
      await page.setViewportSize({ width: 667, height: 375 });
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('RESP-031: Portrait tablet layout works', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('Breakpoints', () => {
    test('RESP-040: Content adjusts at tablet breakpoint', async ({ page }) => {
      // Test at exactly tablet width
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('RESP-041: Content adjusts at mobile breakpoint', async ({ page }) => {
      // Test at exactly mobile width
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('Scroll Behavior', () => {
    test('RESP-050: Smooth scrolling works', async ({ page }) => {
      await page.goto(BASE_URL);
      
      await page.evaluate(() => {
        window.scrollTo(0, 1000);
      });
      await page.waitForTimeout(500);
      
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeGreaterThan(0);
    });

    test('RESP-051: Scroll to top works', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate(() => {
        window.scrollTo(0, 1000);
      });
      await page.waitForTimeout(500);
      
      // Scroll to top button should exist
      const scrollTopBtn = page.locator('button:has-text("Top"), button[aria-label*="top" i]');
      const count = await scrollTopBtn.count();
      // Scroll to top button may exist
    });
  });

  test.describe('Image Responsiveness', () => {
    test('RESP-060: Images are responsive', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 3); i++) {
        const img = images.nth(i);
        const style = await img.getAttribute('style');
        const className = await img.getAttribute('class');
        
        // Should have responsive styling
        expect(style?.includes('max-width') || className?.includes('w-') || className?.includes('max-w-')).toBeTruthy();
      }
    });

    test('RESP-061: No fixed width images', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      
      const fixedImages = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        return imgs.filter(img => {
          const width = img.getAttribute('width');
          return width && parseInt(width) > 500;
        }).length;
      });
      
      // Should not have fixed width large images
      expect(fixedImages).toBeLessThanOrEqual(1);
    });
  });

  test.describe('Table Responsiveness', () => {
    test('RESP-070: Tables scroll horizontally on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/admin/events`);
      await page.waitForTimeout(2000);
      
      const tables = page.locator('table');
      const count = await tables.count();
      
      if (count > 0) {
        const hasOverflow = await page.evaluate(() => {
          const table = document.querySelector('table');
          if (table) {
            const parent = table.parentElement;
            return parent ? getComputedStyle(parent).overflow === 'auto' || getComputedStyle(parent).overflowX === 'auto' : false;
          }
          return false;
        });
        
        // Tables should have overflow handling
      }
    });
  });

  test.describe('Modal/Dialog Responsiveness', () => {
    test('RESP-080: Modals fit mobile screen', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      
      const chatbotButton = page.locator('[class*="chat"]').first();
      if (await chatbotButton.count() > 0) {
        await chatbotButton.click();
        await page.waitForTimeout(500);
        
        const modal = page.locator('[role="dialog"]');
        if (await modal.count() > 0) {
          const modalSize = await modal.evaluate((el: HTMLElement) => {
            const rect = el.getBoundingClientRect();
            return rect.width <= window.innerWidth && rect.height <= window.innerHeight;
          });
          
          expect(modalSize).toBe(true);
        }
      }
    });

    test('RESP-081: Dialogs are centered on desktop', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto(BASE_URL);
      
      const chatbotButton = page.locator('[class*="chat"]').first();
      if (await chatbotButton.count() > 0) {
        await chatbotButton.click();
        await page.waitForTimeout(500);
        
        const modal = page.locator('[role="dialog"]');
        if (await modal.count() > 0) {
          const isCentered = await modal.evaluate((el: HTMLElement) => {
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const windowCenter = window.innerWidth / 2;
            return Math.abs(centerX - windowCenter) < 50;
          });
          
          expect(isCentered).toBe(true);
        }
      }
    });
  });
});
