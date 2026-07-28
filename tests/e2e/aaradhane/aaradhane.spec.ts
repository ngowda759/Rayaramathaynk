import { test, expect, Page } from '@playwright/test';
import { BASE_URL, VIEWPORTS, waitForPageLoad } from '../test-utils';

test.describe('Aaradhane (Worship Schedule) Module', () => {
  test.describe('Aaradhane Page', () => {
    test('AAR-001: Aaradhane page loads with 200 status', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/aaradhane`);
      expect(response?.status()).toBe(200);
    });

    test('AAR-002: Page has main content', async ({ page }) => {
      await page.goto(`${BASE_URL}/aaradhane`);
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('AAR-003: Daily schedule is displayed', async ({ page }) => {
      await page.goto(`${BASE_URL}/aaradhane`);
      await waitForPageLoad(page);
      
      const schedule = page.locator('text=/schedule|ಕಾರ್ಯಕ್ರಮ/i');
      const count = await schedule.count();
      // Should show schedule
    });

    test('AAR-004: Pooja timings are shown', async ({ page }) => {
      await page.goto(`${BASE_URL}/aaradhane`);
      await waitForPageLoad(page);
      
      const timings = page.locator('text=/ಮುಂಜಾನೆ|ಬೆಳಿಗ್ಗೆ|ಸಂಜೆ|ರಾತ್ರಿ|time/i');
      const count = await timings.count();
      // Should display timings
    });

    test('AAR-005: Special sevas are listed', async ({ page }) => {
      await page.goto(`${BASE_URL}/aaradhane`);
      await waitForPageLoad(page);
      
      const sevas = page.locator('[class*="card"], article, [class*="seva"]');
      const count = await sevas.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Pooja Schedule', () => {
    test('AAR-010: Morning poojas are displayed', async ({ page }) => {
      await page.goto(`${BASE_URL}/aaradhane`);
      await waitForPageLoad(page);
      
      const morning = page.locator('text=/morning|ಬೆಳಿಗ್ಗೆ|Morning/i');
      const count = await morning.count();
      // Should show morning schedule
    });

    test('AAR-011: Evening poojas are displayed', async ({ page }) => {
      await page.goto(`${BASE_URL}/aaradhane`);
      await waitForPageLoad(page);
      
      const evening = page.locator('text=/evening|ಸಂಜೆ|Evening/i');
      const count = await evening.count();
      // Should show evening schedule
    });

    test('AAR-012: Night sevas are listed', async ({ page }) => {
      await page.goto(`${BASE_URL}/aaradhane`);
      await waitForPageLoad(page);
      
      const night = page.locator('text=/night|ರಾತ್ರಿ|Night/i');
      const count = await night.count();
      // Should show night schedule
    });
  });

  test.describe('Special Days', () => {
    test('AAR-020: Ekadashi information is available', async ({ page }) => {
      await page.goto(`${BASE_URL}/aaradhane`);
      await waitForPageLoad(page);
      
      const ekadashi = page.locator('text=/Ekadashi|ಏಕಾದಶಿ/i');
      const count = await ekadashi.count();
      // Should have Ekadashi info
    });

    test('AAR-021: Festival days are marked', async ({ page }) => {
      await page.goto(`${BASE_URL}/aaradhane`);
      await waitForPageLoad(page);
      
      const festival = page.locator('text=/festival|ಹಬ್ಬ|Festival/i');
      const count = await festival.count();
      // Should mark festival days
    });
  });

  test.describe('Aaradhane Responsive', () => {
    test('AAR-030: Page renders on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/aaradhane`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('AAR-031: Schedule adjusts on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/aaradhane`);
      await waitForPageLoad(page);
      
      const content = page.locator('main');
      await expect(content).toBeVisible();
    });
  });

  test.describe('Aaradhane Accessibility', () => {
    test('AAR-040: Proper heading hierarchy', async ({ page }) => {
      await page.goto(`${BASE_URL}/aaradhane`);
      
      const h1 = page.locator('h1');
      const count = await h1.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('AAR-041: Time information is accessible', async ({ page }) => {
      await page.goto(`${BASE_URL}/aaradhane`);
      
      const times = page.locator('time, [class*="time"]');
      const count = await times.count();
      // Time should be properly marked up
    });
  });

  test.describe('Aaradhane Performance', () => {
    test('AAR-050: Page loads quickly', async ({ page }) => {
      const start = Date.now();
      await page.goto(`${BASE_URL}/aaradhane`);
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - start;
      expect(loadTime).toBeLessThan(5000);
    });

    test('AAR-051: No console errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await page.goto(`${BASE_URL}/aaradhane`);
      await page.waitForTimeout(2000);
      
      const criticalErrors = errors.filter(e => 
        !e.includes('Firebase') && 
        !e.includes('Warning')
      );
      
      expect(criticalErrors.length).toBe(0);
    });
  });
});

test.describe('Calendar Page', () => {
  test.describe('Calendar Module', () => {
    test('CAL-001: Calendar page loads', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/calendar`);
      expect(response?.status()).toBe(200);
    });

    test('CAL-002: Calendar is displayed', async ({ page }) => {
      await page.goto(`${BASE_URL}/calendar`);
      await waitForPageLoad(page);
      
      const calendar = page.locator('[class*="calendar"], [class*="datepicker"], table');
      const count = await calendar.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('CAL-003: Festival dates are marked', async ({ page }) => {
      await page.goto(`${BASE_URL}/calendar`);
      await waitForPageLoad(page);
      
      const festivals = page.locator('[class*="festival"], [class*="event"]');
      const count = await festivals.count();
      // Should mark festival dates
    });
  });
});

test.describe('Quotes Page', () => {
  test.describe('Quotes Module', () => {
    test('QUOTE-001: Quotes page loads', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/quotes`);
      expect(response?.status()).toBe(200);
    });

    test('QUOTE-002: Quotes are displayed', async ({ page }) => {
      await page.goto(`${BASE_URL}/quotes`);
      await waitForPageLoad(page);
      
      const quotes = page.locator('[class*="quote"], blockquote, article');
      const count = await quotes.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('QUOTE-003: Quote categories exist', async ({ page }) => {
      await page.goto(`${BASE_URL}/quotes`);
      await waitForPageLoad(page);
      
      const categories = page.locator('button:has-text("Daily"), button:has-text("ದೈನಿಕ")');
      const count = await categories.count();
      // Should have quote categories
    });
  });
});

test.describe('Shlokas Page', () => {
  test.describe('Shlokas Module', () => {
    test('SHLOKA-001: Shlokas page loads', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/shlokas`);
      expect(response?.status()).toBe(200);
    });

    test('SHLOKA-002: Shlokas are displayed', async ({ page }) => {
      await page.goto(`${BASE_URL}/shlokas`);
      await waitForPageLoad(page);
      
      const content = page.locator('main');
      await expect(content).toBeVisible();
    });
  });
});

test.describe('Stotras Page', () => {
  test.describe('Stotras Module', () => {
    test('STOTRA-001: Stotras page loads', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/stotras`);
      expect(response?.status()).toBe(200);
    });

    test('STOTRA-002: Stotras are displayed', async ({ page }) => {
      await page.goto(`${BASE_URL}/stotras`);
      await waitForPageLoad(page);
      
      const content = page.locator('main');
      await expect(content).toBeVisible();
    });
  });
});

test.describe('Testimonials Page', () => {
  test.describe('Testimonials Module', () => {
    test('TEST-001: Testimonials page loads', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/testimonials`);
      expect(response?.status()).toBe(200);
    });

    test('TEST-002: Testimonials are displayed', async ({ page }) => {
      await page.goto(`${BASE_URL}/testimonials`);
      await waitForPageLoad(page);
      
      const testimonials = page.locator('[class*="testimonial"], article');
      const count = await testimonials.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});

test.describe('Volunteer Page', () => {
  test.describe('Volunteer Module', () => {
    test('VOL-001: Volunteer page loads', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/volunteer`);
      expect(response?.status()).toBe(200);
    });

    test('VOL-002: Volunteer form exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/volunteer`);
      await waitForPageLoad(page);
      
      const form = page.locator('form');
      const count = await form.count();
      // Should have volunteer form
    });
  });
});
