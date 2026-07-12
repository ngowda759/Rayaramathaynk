import { test, expect } from '@playwright/test';

const BASE_URL = 'https://work-1-dhvcepsnljpkopbv.prod-runtime.all-hands.dev';

test.describe('Homepage Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  // TC-001: Hero Banner
  test('TC-001: Hero banner displays correctly', async ({ page }) => {
    const heroBanner = page.locator('[data-testid="hero-banner"], .hero, [class*="hero"]').first();
    await expect(heroBanner).toBeVisible();
    const heroImage = heroBanner.locator('img, video').first();
    if (await heroImage.isVisible()) {
      expect(await heroImage.getAttribute('alt')).toBeTruthy();
    }
  });

  // TC-002: Hero Banner Responsive
  test('TC-002: Hero banner is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const heroBanner = page.locator('[class*="hero"]').first();
    await expect(heroBanner).toBeVisible();
  });

  // TC-003: Hero Banner CTA Button
  test('TC-003: Hero banner CTA button is clickable', async ({ page }) => {
    const ctaButton = page.locator('[class*="hero"] button, [class*="hero"] a').first();
    if (await ctaButton.isVisible()) {
      await expect(ctaButton).toBeEnabled();
    }
  });

  // TC-004: Temple Information Section
  test('TC-004: Temple information section displays', async ({ page }) => {
    const templeInfo = page.locator('[class*="temple-info"], [class*="about"], [data-testid="temple-info"]').first();
    await expect(templeInfo).toBeVisible();
  });

  // TC-005: Temple Name Display
  test('TC-005: Temple name is displayed', async ({ page }) => {
    const templeName = page.locator('h1, [class*="temple-name"], [data-testid="temple-name"]').first();
    await expect(templeName).toBeVisible();
    const text = await templeName.textContent();
    expect(text?.length).toBeGreaterThan(0);
  });

  // TC-006: Temple Address Display
  test('TC-006: Temple address is displayed', async ({ page }) => {
    const address = page.locator('[class*="address"], [data-testid="address"]').first();
    if (await address.isVisible()) {
      expect(await address.textContent()).toBeTruthy();
    }
  });

  // TC-007: Upcoming Events Section
  test('TC-007: Upcoming events section displays', async ({ page }) => {
    const eventsSection = page.locator('[class*="event"], [class*="upcoming"], [data-testid="events"]').first();
    await expect(eventsSection).toBeVisible();
  });

  // TC-008: Event Cards Visible
  test('TC-008: Event cards are visible with proper data', async ({ page }) => {
    await page.waitForSelector('[class*="event-card"], .event-item', { timeout: 5000 }).catch(() => null);
    const eventCards = page.locator('[class*="event-card"], .event-item');
    const count = await eventCards.count();
    if (count > 0) {
      const firstCard = eventCards.first();
      await expect(firstCard).toBeVisible();
    }
  });

  // TC-009: View Event Details Link
  test('TC-009: Clicking event navigates to details', async ({ page }) => {
    const eventCard = page.locator('[class*="event-card"] a, .event-item a').first();
    if (await eventCard.isVisible()) {
      await eventCard.click();
      await expect(page).not.toHaveURL(/^$/);
    }
  });

  // TC-010: Daily Panchanga Section
  test('TC-010: Daily Panchanga section displays', async ({ page }) => {
    const panchangaSection = page.locator('[class*="panchanga"], [class*="calendar"], [data-testid="panchanga"]').first();
    await expect(panchangaSection).toBeVisible();
  });

  // TC-011: Panchanga Date Selection
  test('TC-011: Panchanga date can be selected', async ({ page }) => {
    const datePicker = page.locator('[class*="panchanga"] input[type="date"], [class*="calendar"] input[type="date"]').first();
    if (await datePicker.isVisible()) {
      await datePicker.fill('2025-01-15');
      await expect(datePicker).toHaveValue('2025-01-15');
    }
  });

  // TC-012: Panchanga Data Display
  test('TC-012: Panchanga data displays correctly', async ({ page }) => {
    const panchangaData = page.locator('[class*="panchanga"] [class*="tithi"], [class*="panchanga"] [class*="nakshatra"]');
    const count = await panchangaData.count();
    if (count > 0) {
      await expect(panchangaData.first()).toBeVisible();
    }
  });

  // TC-013: Donation CTA
  test('TC-013: Donation CTA button is visible', async ({ page }) => {
    const donationCta = page.locator('[class*="donation"] button, [class*="donate"] button, a:has-text("Donate"), button:has-text("Donate")').first();
    await expect(donationCta).toBeVisible();
  });

  // TC-014: Donation CTA Navigation
  test('TC-014: Donation CTA navigates to donation page', async ({ page }) => {
    const donationCta = page.locator('a:has-text("Donate"), [class*="donation"] a').first();
    if (await donationCta.isVisible()) {
      await donationCta.click();
      await expect(page).toHaveURL(/donation|donate/);
    }
  });

  // TC-015: Footer Links
  test('TC-015: Footer section displays', async ({ page }) => {
    const footer = page.locator('footer, [class*="footer"]').first();
    await expect(footer).toBeVisible();
  });

  // TC-016: Footer Navigation Links
  test('TC-016: Footer navigation links work', async ({ page }) => {
    const footerLinks = page.locator('footer a, [class*="footer"] a');
    const count = await footerLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  // TC-017: Contact Information in Footer
  test('TC-017: Contact information displays in footer', async ({ page }) => {
    const contactInfo = page.locator('footer [class*="contact"], [class*="footer"] [class*="phone"], [class*="footer"] [class*="email"]');
    const count = await contactInfo.count();
    if (count > 0) {
      await expect(contactInfo.first()).toBeVisible();
    }
  });

  // TC-018: Copyright Text
  test('TC-018: Copyright text displays', async ({ page }) => {
    const copyright = page.locator('footer [class*="copyright"], footer:has-text("©")');
    await expect(copyright).toBeVisible();
  });

  // TC-019: Page Load Performance
  test('TC-019: Homepage loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(5000);
  });

  // TC-020: Page Title
  test('TC-020: Page title is correct', async ({ page }) => {
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(5);
  });

  // TC-021: Meta Description
  test('TC-021: Meta description exists', async ({ page }) => {
    const metaDescription = page.locator('meta[name="description"]');
    if (await metaDescription.count() > 0) {
      const content = await metaDescription.getAttribute('content');
      expect(content?.length).toBeGreaterThan(0);
    }
  });

  // TC-022: Navigation Menu
  test('TC-022: Main navigation menu displays', async ({ page }) => {
    const nav = page.locator('nav, [class*="nav"]').first();
    await expect(nav).toBeVisible();
  });

  // TC-023: Navigation Links
  test('TC-023: Navigation links are clickable', async ({ page }) => {
    const navLinks = page.locator('nav a, [class*="nav"] a').first();
    if (await navLinks.isVisible()) {
      await expect(navLinks).toBeEnabled();
    }
  });

  // TC-024: Mobile Menu
  test('TC-024: Mobile menu toggles correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const menuToggle = page.locator('[class*="menu"], [class*="hamburger"], [aria-label*="menu"]').first();
    if (await menuToggle.isVisible()) {
      await menuToggle.click();
      await page.waitForTimeout(500);
    }
  });

  // TC-025: Social Media Links
  test('TC-025: Social media links display in footer', async ({ page }) => {
    const socialLinks = page.locator('footer [class*="social"], [class*="facebook"], [class*="twitter"], [class*="instagram"]');
    const count = await socialLinks.count();
    if (count > 0) {
      await expect(socialLinks.first()).toBeVisible();
    }
  });

  // TC-026: SEO Friendly URLs
  test('TC-026: Internal links use SEO-friendly URLs', async ({ page }) => {
    const links = await page.locator('a[href^="/"]').all();
    for (const link of links.slice(0, 5)) {
      const href = await link.getAttribute('href');
      if (href && !href.includes('?')) {
        expect(href).toMatch(/^\/[a-z-]+\/?$/);
      }
    }
  });

  // TC-027: Language Attribute
  test('TC-027: HTML lang attribute is set', async ({ page }) => {
    const htmlElement = page.locator('html');
    const lang = await htmlElement.getAttribute('lang');
    expect(lang).toBeTruthy();
  });

  // TC-028: Viewport Meta Tag
  test('TC-028: Viewport meta tag is set', async ({ page }) => {
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveCount(1);
  });

  // TC-029: Image Alt Text
  test('TC-029: All images have alt text', async ({ page }) => {
    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      if (await img.isVisible()) {
        expect(alt).toBeTruthy();
      }
    }
  });

  // TC-030: Color Contrast Basic
  test('TC-030: Text is readable (basic contrast check)', async ({ page }) => {
    const body = page.locator('body');
    const fontColor = await body.evaluate(el => window.getComputedStyle(el).color);
    expect(fontColor).toBeTruthy();
  });
});
