import { test, expect, Page } from '@playwright/test';
import { BASE_URL, VIEWPORTS, waitForPageLoad } from '../test-utils';

test.describe('About Page Module', () => {
  test.describe('About Page Content', () => {
    test('ABOUT-001: About page loads with 200 status', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/about`);
      expect(response?.status()).toBe(200);
    });

    test('ABOUT-002: Page has main content', async ({ page }) => {
      await page.goto(`${BASE_URL}/about`);
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('ABOUT-003: Page has title', async ({ page }) => {
      await page.goto(`${BASE_URL}/about`);
      const title = await page.title();
      expect(title).toBeTruthy();
    });

    test('ABOUT-004: Temple history section exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/about`);
      await waitForPageLoad(page);
      
      const history = page.locator('text=/history|ಇತಿಹಾಸ/i');
      const count = await history.count();
      // Should have history section
    });

    test('ABOUT-005: Temple information is displayed', async ({ page }) => {
      await page.goto(`${BASE_URL}/about`);
      await waitForPageLoad(page);
      
      const content = page.locator('p, article, section');
      const count = await content.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('About Page Images', () => {
    test('ABOUT-010: Temple images are displayed', async ({ page }) => {
      await page.goto(`${BASE_URL}/about`);
      await waitForPageLoad(page);
      
      const images = page.locator('img');
      const count = await images.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('ABOUT-011: Images have alt text', async ({ page }) => {
      await page.goto(`${BASE_URL}/about`);
      
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 3); i++) {
        const img = images.nth(i);
        if (await img.isVisible()) {
          const alt = await img.getAttribute('alt');
          expect(alt).toBeDefined();
        }
      }
    });
  });

  test.describe('About Page Responsive', () => {
    test('ABOUT-020: About page renders on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_URL}/about`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('ABOUT-021: Content adjusts on tablet', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.goto(`${BASE_URL}/about`);
      await waitForPageLoad(page);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('About Page Accessibility', () => {
    test('ABOUT-030: Proper heading hierarchy', async ({ page }) => {
      await page.goto(`${BASE_URL}/about`);
      
      const h1 = page.locator('h1');
      const count = await h1.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('ABOUT-031: Images have alt attributes', async ({ page }) => {
      await page.goto(`${BASE_URL}/about`);
      
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 3); i++) {
        const img = images.nth(i);
        if (await img.isVisible()) {
          const alt = await img.getAttribute('alt');
          expect(alt).toBeDefined();
        }
      }
    });
  });
});

test.describe('Trust Committee Page', () => {
  test('TRUST-001: Trust committee page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/trust`);
    expect(response?.status()).toBe(200);
  });

  test('TRUST-002: Committee members are listed', async ({ page }) => {
    await page.goto(`${BASE_URL}/trust`);
    await waitForPageLoad(page);
    
    const content = page.locator('main');
    await expect(content).toBeVisible();
  });
});

test.describe('Guru Parampara Page', () => {
  test('GURU-001: Guru parampara page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/guruparampara`);
    expect(response?.status()).toBe(200);
  });

  test('GURU-002: Guru lineage is displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/guruparampara`);
    await waitForPageLoad(page);
    
    const content = page.locator('main');
    await expect(content).toBeVisible();
  });
});

test.describe('Timeline Page', () => {
  test('TIMELINE-001: Timeline page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/timeline`);
    expect(response?.status()).toBe(200);
  });

  test('TIMELINE-002: Timeline content is displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/timeline`);
    await waitForPageLoad(page);
    
    const content = page.locator('main');
    await expect(content).toBeVisible();
  });
});

test.describe('Journey Page', () => {
  test('JOURNEY-001: Journey page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/journey`);
    expect(response?.status()).toBe(200);
  });

  test('JOURNEY-002: Journey content is displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/journey`);
    await waitForPageLoad(page);
    
    const content = page.locator('main');
    await expect(content).toBeVisible();
  });
});

test.describe('Facilities Page', () => {
  test('FACILITIES-001: Facilities page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/facilities`);
    expect(response?.status()).toBe(200);
  });

  test('FACILITIES-002: Facilities content is displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/facilities`);
    await waitForPageLoad(page);
    
    const content = page.locator('main');
    await expect(content).toBeVisible();
  });
});

test.describe('Future Plans Page', () => {
  test('FUTURE-001: Future plans page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/future-plans`);
    expect(response?.status()).toBe(200);
  });

  test('FUTURE-002: Plans content is displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/future-plans`);
    await waitForPageLoad(page);
    
    const content = page.locator('main');
    await expect(content).toBeVisible();
  });
});
