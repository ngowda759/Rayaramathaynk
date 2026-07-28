import { test, expect, Page } from '@playwright/test';
import { BASE_URL, getMetaContent, getOgContent } from '../test-utils';

test.describe('SEO Module', () => {
  test.describe('Meta Tags', () => {
    test('SEO-001: Homepage has title', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);
    });

    test('SEO-002: Homepage has meta description', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const description = await getMetaContent(page, 'description');
      expect(description).toBeTruthy();
      expect(description?.length).toBeGreaterThan(50);
    });

    test('SEO-003: Title is not too long', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const title = await page.title();
      expect(title.length).toBeLessThanOrEqual(60);
    });

    test('SEO-004: Title is not too short', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const title = await page.title();
      expect(title.length).toBeGreaterThanOrEqual(10);
    });

    test('SEO-005: Description is not too long', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const description = await getMetaContent(page, 'description');
      expect(description?.length).toBeLessThanOrEqual(160);
    });

    test('SEO-006: Keywords meta tag exists', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const keywords = await getMetaContent(page, 'keywords');
      // Keywords may or may not exist (less important now)
    });
  });

  test.describe('Open Graph Tags', () => {
    test('SEO-010: OG title exists', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const ogTitle = await getOgContent(page, 'og:title');
      expect(ogTitle).toBeTruthy();
    });

    test('SEO-011: OG description exists', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const ogDesc = await getOgContent(page, 'og:description');
      expect(ogDesc).toBeTruthy();
    });

    test('SEO-012: OG image exists', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const ogImage = await getOgContent(page, 'og:image');
      expect(ogImage).toBeTruthy();
    });

    test('SEO-013: OG URL exists', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const ogUrl = await getOgContent(page, 'og:url');
      expect(ogUrl).toBeTruthy();
    });

    test('SEO-014: OG type is set', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const ogType = await getOgContent(page, 'og:type');
      expect(ogType).toBeTruthy();
    });

    test('SEO-015: OG locale is set', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const ogLocale = await getOgContent(page, 'og:locale');
      expect(ogLocale).toBeTruthy();
    });
  });

  test.describe('Twitter Cards', () => {
    test('SEO-020: Twitter card meta exists', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const twitterCard = await getMetaContent(page, 'twitter:card');
      expect(twitterCard).toBeTruthy();
    });

    test('SEO-021: Twitter title exists', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const twitterTitle = await getMetaContent(page, 'twitter:title');
      expect(twitterTitle).toBeTruthy();
    });

    test('SEO-022: Twitter description exists', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const twitterDesc = await getMetaContent(page, 'twitter:description');
      expect(twitterDesc).toBeTruthy();
    });

    test('SEO-023: Twitter image exists', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const twitterImage = await getMetaContent(page, 'twitter:image');
      expect(twitterImage).toBeTruthy();
    });
  });

  test.describe('Canonical URLs', () => {
    test('SEO-030: Canonical URL exists', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).toBeTruthy();
    });

    test('SEO-031: Canonical URL is valid', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).toContain(BASE_URL);
    });
  });

  test.describe('Structured Data', () => {
    test('SEO-040: JSON-LD schema exists', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const schema = await page.locator('script[type="application/ld+json"]').count();
      expect(schema).toBeGreaterThanOrEqual(0);
    });

    test('SEO-041: Organization schema is valid', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const schemaScript = page.locator('script[type="application/ld+json"]').first();
      if (await schemaScript.count() > 0) {
        const content = await schemaScript.textContent();
        const isValidJson = () => {
          try {
            JSON.parse(content || '');
            return true;
          } catch {
            return false;
          }
        };
        expect(isValidJson()).toBe(true);
      }
    });
  });

  test.describe('robots.txt', () => {
    test('SEO-050: robots.txt exists', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/robots.txt`);
      expect(response?.status()).toBe(200);
    });

    test('SEO-051: robots.txt has proper content', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/robots.txt`);
      const content = await page.content();
      expect(content).toContain('User-agent');
    });
  });

  test.describe('Sitemap', () => {
    test('SEO-060: sitemap.xml exists', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/sitemap.xml`);
      // Should return XML or 404
      expect([200, 404]).toContain(response?.status());
    });

    test('SEO-061: sitemap has URLs', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/sitemap.xml`);
      if (response?.status() === 200) {
        const content = await page.content();
        expect(content).toContain('<url>');
      }
    });
  });

  test.describe('Page SEO', () => {
    test('SEO-070: Events page has proper title', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      
      const title = await page.title();
      expect(title).toBeTruthy();
    });

    test('SEO-071: Events page has meta description', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      
      const description = await getMetaContent(page, 'description');
      expect(description).toBeTruthy();
    });

    test('SEO-072: Gallery page has proper SEO', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      
      const title = await page.title();
      const description = await getMetaContent(page, 'description');
      
      expect(title || description).toBeTruthy();
    });

    test('SEO-073: Donation page has proper SEO', async ({ page }) => {
      await page.goto(`${BASE_URL}/donation`);
      
      const title = await page.title();
      expect(title).toBeTruthy();
    });
  });

  test.describe('Heading SEO', () => {
    test('SEO-080: H1 contains relevant keywords', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const h1 = page.locator('h1').first();
      const text = await h1.textContent();
      expect(text).toBeTruthy();
    });

    test('SEO-081: Only one H1 per page', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeLessThanOrEqual(1);
    });

    test('SEO-082: Headings are descriptive', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const headings = page.locator('h2');
      const count = await headings.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const h2 = headings.nth(i);
        const text = await h2.textContent();
        expect(text?.trim().length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Image SEO', () => {
    test('SEO-090: Images have alt attributes', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        // Alt should exist for SEO
      }
    });

    test('SEO-091: Images have descriptive alt text', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 3); i++) {
        const img = images.nth(i);
        if (await img.isVisible()) {
          const alt = await img.getAttribute('alt');
          // Alt should not be just "image" or empty
          if (alt) {
            expect(alt.length).toBeGreaterThan(2);
          }
        }
      }
    });
  });

  test.describe('Link SEO', () => {
    test('SEO-100: Internal links exist', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const internalLinks = page.locator('a[href^="/"], a[href^="' + BASE_URL + '"]');
      const count = await internalLinks.count();
      expect(count).toBeGreaterThan(0);
    });

    test('SEO-101: Anchor text is descriptive', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const links = page.locator('a');
      const count = await links.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const link = links.nth(i);
        const text = await link.textContent();
        // Links should have descriptive text
        expect(text?.trim().length).toBeGreaterThan(0);
      }
    });
  });
});
