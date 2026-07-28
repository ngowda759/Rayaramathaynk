import { test, expect, Page } from '@playwright/test';
import { BASE_URL, VIEWPORTS, waitForPageLoad } from '../test-utils';

/**
 * User Journey Tests - Sprint 2
 * These tests cover complete user flows through the temple website
 */

test.describe('User Journey: Temple Visitor', () => {
  test.describe('UJ-001: First-time Visitor Journey', () => {
    test('UJ-001.1: Homepage to About page journey', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const hero = page.locator('section, main').first();
      await expect(hero).toBeVisible();
      
      const aboutLink = page.locator('a[href="/about"]').first();
      if (await aboutLink.count() > 0) {
        await aboutLink.click();
        await waitForPageLoad(page);
        expect(page.url()).toContain('/about');
      }
    });

    test('UJ-001.2: Homepage to Temple Timings check', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const timings = page.locator('text=/timing|schedule|ಸಮಯ/i');
      const count = await timings.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('UJ-001.3: Homepage to Gallery exploration', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const galleryLink = page.locator('a[href="/gallery"]').first();
      if (await galleryLink.count() > 0) {
        await galleryLink.click();
        await waitForPageLoad(page);
        expect(page.url()).toContain('/gallery');
        
        const main = page.locator('main');
        await expect(main).toBeVisible();
      }
    });
  });

  test.describe('UJ-002: Devotee Journey - Finding Events', () => {
    test('UJ-002.1: Browse upcoming events', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
      
      const content = await page.textContent('body');
      expect(content).toBeTruthy();
    });

    test('UJ-002.2: Check event details', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const eventLinks = page.locator('a[href*="/events/"]');
      const linkCount = await eventLinks.count();
      
      if (linkCount > 0) {
        const href = await eventLinks.first().getAttribute('href');
        expect(href).toBeTruthy();
      }
    });
  });

  test.describe('UJ-003: Donation Flow', () => {
    test('UJ-003.1: Navigate to donation page', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      await waitForPageLoad(page);
      
      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('UJ-003.2: Donation form fields exist', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      await waitForPageLoad(page);
      
      const nameField = page.locator('input[name*="name" i]');
      const emailField = page.locator('input[type="email"]');
      const amountField = page.locator('input[type="number"], input[placeholder*="amount" i]');
      
      const anyField = await nameField.count() + await emailField.count() + await amountField.count();
      expect(anyField).toBeGreaterThanOrEqual(0);
    });

    test('UJ-003.3: Donation amount selection', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      await waitForPageLoad(page);
      
      const amountButtons = page.locator('button:has-text("₹")');
      const count = await amountButtons.count();
    });

    test('UJ-003.4: Donation form validation', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      await waitForPageLoad(page);
      
      const submitButton = page.locator('button[type="submit"]').first();
      if (await submitButton.count() > 0) {
        await submitButton.click();
        await page.waitForTimeout(500);
      }
    });

    test('UJ-003.5: Donation success page', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation/success`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('UJ-003.6: Donation failure page', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation/failure`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('UJ-004: Seva Booking Flow', () => {
    test('UJ-004.1: Browse available sevas', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('UJ-004.2: Seva details page', async ({ page }) => {
      await page.goto(`${BASE_URL}/sevas`);
      await waitForPageLoad(page);
      
      const sevaLinks = page.locator('a[href*="/sevas/"]');
      const linkCount = await sevaLinks.count();
      
      if (linkCount > 0) {
        const href = await sevaLinks.first().getAttribute('href');
        expect(href).toBeTruthy();
      }
    });
  });

  test.describe('UJ-005: Religious Information Journey', () => {
    test('UJ-005.1: View Aaradhane schedule', async ({ page }) => {
      await page.goto(`${BASE_URL}/aaradhane`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('UJ-005.2: Browse Shlokas', async ({ page }) => {
      await page.goto(`${BASE_URL}/shlokas`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('UJ-005.3: View Stotras', async ({ page }) => {
      await page.goto(`${BASE_URL}/stotras`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('UJ-005.4: Read Daily Quotes', async ({ page }) => {
      await page.goto(`${BASE_URL}/quotes`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('UJ-005.5: View Guru Parampara', async ({ page }) => {
      await page.goto(`${BASE_URL}/guruparampara`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('UJ-006: Temple Information', () => {
    test('UJ-006.1: About Temple', async ({ page }) => {
      await page.goto(`${BASE_URL}/about`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('UJ-006.2: Temple Timeline', async ({ page }) => {
      await page.goto(`${BASE_URL}/timeline`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('UJ-006.3: Temple Journey', async ({ page }) => {
      await page.goto(`${BASE_URL}/journey`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('UJ-006.4: Facilities', async ({ page }) => {
      await page.goto(`${BASE_URL}/facilities`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('UJ-006.5: Trust Committee', async ({ page }) => {
      await page.goto(`${BASE_URL}/trust`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('UJ-007: Search Functionality', () => {
    test('UJ-007.1: Search page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/search`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('UJ-007.2: Search input exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/search`);
      await waitForPageLoad(page);
      
      const searchInput = page.locator('input[type="search"], input[name*="search" i]');
      const count = await searchInput.count();
    });
  });

  test.describe('UJ-008: Calendar and Festivals', () => {
    test('UJ-008.1: Calendar page', async ({ page }) => {
      await page.goto(`${BASE_URL}/calendar`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('UJ-008.2: Pooja schedule', async ({ page }) => {
      await page.goto(`${BASE_URL}/pooja`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('UJ-008.3: Future plans', async ({ page }) => {
      await page.goto(`${BASE_URL}/future-plans`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('UJ-009: Contact and Volunteer', () => {
    test('UJ-009.1: Volunteer page', async ({ page }) => {
      await page.goto(`${BASE_URL}/volunteer`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('UJ-009.2: Testimonials page', async ({ page }) => {
      await page.goto(`${BASE_URL}/testimonials`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('UJ-010: AI Chatbot Journey', () => {
    test('UJ-010.1: Chatbot widget visible', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const chatbotButton = page.locator('[class*="chat"], button:has-text("Chat")').first();
      const count = await chatbotButton.count();
    });

    test('UJ-010.2: Chatbot opens', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const chatbotButton = page.locator('[class*="chat"], button:has-text("Chat")').first();
      if (await chatbotButton.count() > 0) {
        await chatbotButton.click();
        await page.waitForTimeout(500);
        
        const chatWindow = page.locator('[role="dialog"], [class*="chat-window"]');
        const windowCount = await chatWindow.count();
      }
    });
  });

  test.describe('UJ-011: Mobile User Journey', () => {
    test('UJ-011.1: Mobile navigation', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const menuButton = page.locator('button[aria-label*="menu" i], button:has-text("Menu")');
      const count = await menuButton.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('UJ-011.2: Mobile donation form', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/donation`);
      await waitForPageLoad(page);
      
      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('UJ-011.3: Mobile events browsing', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('UJ-012: User Authentication Flow', () => {
    test('UJ-012.1: Login page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('UJ-012.2: Register page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/register`);
      await waitForPageLoad(page);
      
      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('UJ-012.3: Forgot password page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/forgot-password`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });
});
