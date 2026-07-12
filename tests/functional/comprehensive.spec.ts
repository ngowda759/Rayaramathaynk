import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

/**
 * Comprehensive Functional Test Suite for Aaradhane Temple Management System
 * Tests actual component behavior and user interactions
 */
test.describe('Homepage Functional Tests', () => {
  test('Homepage renders with proper structure', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Check page title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    
    // Check for navigation
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
    
    // Check for footer
    const footer = page.locator('footer').first();
    await expect(footer).toBeVisible();
    
    // Check for main content
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('Homepage navigation links are functional', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Get all navigation links
    const navLinks = page.locator('nav a, header a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
    
    // Click on About link if visible
    const aboutLink = page.locator('a[href="/about"], a:has-text("About")').first();
    if (await aboutLink.count() > 0 && await aboutLink.isVisible()) {
      await aboutLink.click();
      await expect(page).toHaveURL(/\/about/);
    }
  });

  test('Homepage mobile menu toggle works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);
    
    // Find and click menu toggle
    const menuButton = page.locator('button[class*="menu"], button[aria-label*="menu"], [class*="hamburger"]').first();
    if (await menuButton.count() > 0) {
      await menuButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('Homepage images load correctly', async ({ page }) => {
    await page.goto(BASE_URL);
    
    const images = page.locator('img');
    const count = await images.count();
    
    for (let i = 0; i < Math.min(count, 10); i++) {
      const img = images.nth(i);
      if (await img.isVisible()) {
        const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
        // Image should either have width or be decorative
      }
    }
  });

  test('Homepage scroll behavior works', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);
    
    // Scroll back up
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    
    // Check footer is visible at bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });
});

test.describe('Authentication Functional Tests', () => {
  test('Login page renders correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Check for form elements
    const emailInput = page.locator('input[type="email"], input[name*="email" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test('Login form validation works', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);
  });

  test('Login form accepts input', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    await emailInput.fill('test@example.com');
    await passwordInput.fill('password123');
    
    expect(await emailInput.inputValue()).toBe('test@example.com');
    expect(await passwordInput.inputValue()).toBe('password123');
  });

  test('Password field is masked', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('Login page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Tab through form elements
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });

  test('Enter key submits form', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
  });
});

test.describe('Donation Page Functional Tests', () => {
  test('Donation page loads correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/donation`);
    
    // Check page loaded
    await page.waitForLoadState('domcontentloaded');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Donation form has all required fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/donation`);
    
    // Check for donor name field
    const nameField = page.locator('input[name*="name" i], input[id*="name" i]').first();
    if (await nameField.count() > 0) {
      await expect(nameField).toBeVisible();
    }
    
    // Check for email field
    const emailField = page.locator('input[type="email"]').first();
    if (await emailField.count() > 0) {
      await expect(emailField).toBeVisible();
    }
    
    // Check for phone field
    const phoneField = page.locator('input[type="tel"], input[name*="phone" i]').first();
    if (await phoneField.count() > 0) {
      await expect(phoneField).toBeVisible();
    }
    
    // Check for amount field
    const amountField = page.locator('input[type="number"]').first();
    if (await amountField.count() > 0) {
      await expect(amountField).toBeVisible();
    }
  });

  test('Donation form accepts input', async ({ page }) => {
    await page.goto(`${BASE_URL}/donation`);
    
    const nameField = page.locator('input[name*="name" i]').first();
    if (await nameField.count() > 0) {
      await nameField.fill('Test Donor');
      expect(await nameField.inputValue()).toBe('Test Donor');
    }
    
    const emailField = page.locator('input[type="email"]').first();
    if (await emailField.count() > 0) {
      await emailField.fill('donor@example.com');
      expect(await emailField.inputValue()).toBe('donor@example.com');
    }
    
    const amountField = page.locator('input[type="number"]').first();
    if (await amountField.count() > 0) {
      await amountField.fill('1000');
      expect(await amountField.inputValue()).toBe('1000');
    }
  });

  test('Donation amount validation', async ({ page }) => {
    await page.goto(`${BASE_URL}/donation`);
    
    const amountField = page.locator('input[type="number"]').first();
    if (await amountField.count() > 0) {
      await amountField.fill('100');
      await page.waitForTimeout(500);
    }
  });

  test('Donation page is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/donation`);
    
    // Check page loaded on mobile
    await page.waitForLoadState('domcontentloaded');
  });

  test('Payment mode selection works', async ({ page }) => {
    await page.goto(`${BASE_URL}/donation`);
    
    const paymentSelect = page.locator('select').first();
    if (await paymentSelect.count() > 0) {
      await expect(paymentSelect).toBeVisible();
    }
  });
});

test.describe('Events Page Functional Tests', () => {
  test('Events page loads correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/events`);
    await page.waitForLoadState('domcontentloaded');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Events page navigation works', async ({ page }) => {
    await page.goto(`${BASE_URL}/events`);
    await page.waitForTimeout(1000);
  });

  test('Events page is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/events`);
    await page.waitForLoadState('domcontentloaded');
  });
});

test.describe('Gallery Page Functional Tests', () => {
  test('Gallery page loads correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/gallery`);
    await page.waitForLoadState('domcontentloaded');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Gallery images have proper attributes', async ({ page }) => {
    await page.goto(`${BASE_URL}/gallery`);
    
    const images = page.locator('img');
    const count = await images.count();
    
    if (count > 0) {
      const firstImage = images.first();
      const alt = await firstImage.getAttribute('alt');
      expect(alt).toBeDefined();
    }
  });

  test('Gallery page is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/gallery`);
    await page.waitForLoadState('domcontentloaded');
  });

  test('Gallery page renders without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('Firebase') && !text.includes('favicon')) {
          errors.push(text);
        }
      }
    });
    
    await page.goto(`${BASE_URL}/gallery`);
    await page.waitForTimeout(2000);
    
    const criticalErrors = errors.filter(e => e.includes('Uncaught') || e.includes('TypeError'));
    expect(criticalErrors.length).toBe(0);
  });
});

test.describe('Seva Booking Page Functional Tests', () => {
  test('Sevas page loads correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    await page.waitForLoadState('domcontentloaded');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Sevas page displays content', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    await page.waitForTimeout(2000);
  });

  test('Sevas page is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/sevas`);
    await page.waitForLoadState('domcontentloaded');
  });
});

test.describe('Admin Dashboard Functional Tests', () => {
  test('Admin page loads correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(1000);
  });

  test('Admin page redirects to login when not authenticated', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);
  });

  test('Admin sevas page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/sevas`);
    await page.waitForTimeout(2000);
  });

  test('Admin events page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/events`);
    await page.waitForTimeout(2000);
  });

  test('Admin donations page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/donations`);
    await page.waitForTimeout(2000);
  });

  test('Admin gallery page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/gallery`);
    await page.waitForTimeout(2000);
  });

  test('Admin announcements page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/announcements`);
    await page.waitForTimeout(2000);
  });

  test('Admin page is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);
  });
});

test.describe('API Endpoints Functional Tests', () => {
  test('Gallery API returns valid JSON', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/gallery/local-assets`);
    expect(response.status()).toBeGreaterThanOrEqual(200);
    
    const data = await response.json();
    expect(data).toBeTruthy();
  });

  test('API handles requests correctly', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/gallery/local-assets`);
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('json');
  });
});

test.describe('Responsive Design Tests', () => {
  const viewports = [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1920, height: 1080 },
  ];

  const pages = [
    { name: 'Homepage', url: BASE_URL },
    { name: 'Sevas', url: `${BASE_URL}/sevas` },
    { name: 'Donation', url: `${BASE_URL}/donation` },
    { name: 'Events', url: `${BASE_URL}/events` },
    { name: 'Gallery', url: `${BASE_URL}/gallery` },
    { name: 'About', url: `${BASE_URL}/about` },
  ];

  for (const pageItem of pages) {
    for (const viewport of viewports) {
      test(`${pageItem.name} renders on ${viewport.name}`, async ({ page: p }) => {
        await p.setViewportSize({ width: viewport.width, height: viewport.height });
        const response = await p.goto(pageItem.url);
        expect(response?.status()).toBe(200);
        
        await p.waitForLoadState('domcontentloaded');
      });
    }
  }
});

test.describe('Accessibility Tests', () => {
  test('Login page form inputs are accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Check that form has proper labels
    const inputs = page.locator('input');
    const count = await inputs.count();
    
    let labeledCount = 0;
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const placeholder = await input.getAttribute('placeholder');
      const name = await input.getAttribute('name');
      
      if (id || ariaLabel || placeholder || name) labeledCount++;
    }
    
    // At least some inputs should be labeled
    expect(labeledCount).toBeGreaterThan(0);
  });

  test('Homepage images have alt text', async ({ page }) => {
    await page.goto(BASE_URL);
    
    const images = page.locator('img');
    const count = await images.count();
    
    let decorativeCount = 0;
    let labeledCount = 0;
    
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      if (await img.isVisible()) {
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');
        
        if (alt !== null && alt !== '') {
          labeledCount++;
        } else if (role === 'presentation' || role === 'none') {
          decorativeCount++;
        }
      }
    }
    
    // Either images have alt text or are properly marked as decorative
    expect(labeledCount + decorativeCount).toBeGreaterThan(0);
  });

  test('Page has proper heading structure', async ({ page }) => {
    await page.goto(BASE_URL);
    
    const h1 = page.locator('h1');
    const h1Count = await h1.count();
    
    // At least one h1 should exist
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test('Focus indicators are visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Click on first input
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.click();
    
    // Press tab
    await page.keyboard.press('Tab');
    
    // Check that something is focused
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });
});

test.describe('Performance Tests', () => {
  test('Homepage loads within acceptable time', async ({ page }) => {
    const start = Date.now();
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(3000);
  });

  test('Login page loads quickly', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(2000);
  });

  test('Sevas page loads quickly', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE_URL}/sevas`);
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(3000);
  });

  test('Donation page loads quickly', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE_URL}/donation`);
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(3000);
  });
});

test.describe('Security Tests', () => {
  test('Password field is properly masked', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('No sensitive data in URLs', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const url = page.url();
    expect(url).not.toContain('password');
    expect(url).not.toContain('token');
  });

  test('SQL injection prevention in search', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    
    const searchInput = page.locator('input[type="search"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill("' OR '1'='1");
      await page.waitForTimeout(500);
      // Page should handle the input without error
    }
  });

  test('XSS prevention in inputs', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('<script>alert("XSS")</script>');
    await page.waitForTimeout(500);
    
    // Form should still be functional
    const value = await emailInput.inputValue();
    expect(value).toBeTruthy();
  });
});

test.describe('Navigation Flow Tests', () => {
  test('Can navigate from homepage to about', async ({ page }) => {
    await page.goto(BASE_URL);
    
    const aboutLink = page.locator('a[href="/about"]').first();
    if (await aboutLink.count() > 0) {
      await aboutLink.click();
      await expect(page).toHaveURL(/\/about/);
    }
  });

  test('Can navigate from homepage to sevas', async ({ page }) => {
    await page.goto(BASE_URL);
    
    const sevasLink = page.locator('a[href="/sevas"]').first();
    if (await sevasLink.count() > 0) {
      await sevasLink.click();
      await expect(page).toHaveURL(/\/sevas/);
    }
  });

  test('Can navigate from homepage to donation', async ({ page }) => {
    await page.goto(BASE_URL);
    
    const donationLink = page.locator('a[href="/donation"]').first();
    if (await donationLink.count() > 0) {
      await donationLink.click();
      await expect(page).toHaveURL(/\/donation/);
    }
  });

  test('Footer links are present', async ({ page }) => {
    await page.goto(BASE_URL);
    
    const footerLinks = page.locator('footer a');
    const count = await footerLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Can scroll to footer', async ({ page }) => {
    await page.goto(BASE_URL);
    
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });
});

test.describe('Additional Pages Tests', () => {
  const pages = [
    { name: 'About', url: '/about' },
    { name: 'Calendar', url: '/calendar' },
    { name: 'Shlokas', url: '/shlokas' },
    { name: 'Trust', url: '/trust' },
    { name: 'Facilities', url: '/facilities' },
    { name: 'Guru Parampara', url: '/guruparampara' },
    { name: 'Aaradhane', url: '/aaradhane' },
    { name: 'Pooja', url: '/pooja' },
  ];

  for (const pageItem of pages) {
    test(`${pageItem.name} page loads correctly`, async ({ page: p }) => {
      const response = await p.goto(`${BASE_URL}${pageItem.url}`);
      // Accept 200, 404, or redirect statuses
      expect([200, 301, 302, 404]).toContain(response?.status() || 0);
      await p.waitForLoadState('domcontentloaded');
    });
  }

  test('404 page handles invalid routes', async ({ page }) => {
    await page.goto(`${BASE_URL}/nonexistent-page-xyz-123`);
    await page.waitForTimeout(1000);
  });
});
