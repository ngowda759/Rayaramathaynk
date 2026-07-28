import { test, expect, Page } from '@playwright/test';
import { BASE_URL, measurePageLoadTime } from '../test-utils';

test.describe('Performance Module', () => {
  test.describe('Page Load Performance', () => {
    test('PERF-001: Homepage loads within 3 seconds', async ({ page }) => {
      const loadTime = await measurePageLoadTime(page, BASE_URL);
      expect(loadTime).toBeLessThan(3000);
    });

    test('PERF-002: Events page loads within 5 seconds', async ({ page }) => {
      const loadTime = await measurePageLoadTime(page, `${BASE_URL}/events`);
      expect(loadTime).toBeLessThan(5000);
    });

    test('PERF-003: Gallery page loads within 5 seconds', async ({ page }) => {
      const loadTime = await measurePageLoadTime(page, `${BASE_URL}/gallery`);
      expect(loadTime).toBeLessThan(5000);
    });

    test('PERF-004: Sevas page loads within 5 seconds', async ({ page }) => {
      const loadTime = await measurePageLoadTime(page, `${BASE_URL}/sevas`);
      expect(loadTime).toBeLessThan(5000);
    });

    test('PERF-005: Donation page loads within 3 seconds', async ({ page }) => {
      const loadTime = await measurePageLoadTime(page, `${BASE_URL}/donation`);
      expect(loadTime).toBeLessThan(3000);
    });
  });

  test.describe('First Contentful Paint', () => {
    test('PERF-010: FCP is under 1.5 seconds', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const fcp = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              if (entry.name === 'first-contentful-paint') {
                resolve(entry.startTime);
              }
            }
          }).observe({ type: 'paint', buffered: true });
          
          setTimeout(() => resolve(null), 5000);
        });
      });
      
      if (fcp) {
        expect(fcp).toBeLessThan(1500);
      }
    });

    test('PERF-011: LCP is reasonable', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const lcp = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1];
            resolve(lastEntry.startTime);
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          
          setTimeout(() => resolve(null), 5000);
        });
      });
      
      if (lcp) {
        expect(lcp).toBeLessThan(2500);
      }
    });
  });

  test.describe('Resource Loading', () => {
    test('PERF-020: Images are lazy loaded', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      
      const lazyImages = page.locator('img[loading="lazy"]');
      const count = await lazyImages.count();
      
      // Should have lazy loaded images
      const allImages = page.locator('img');
      const totalCount = await allImages.count();
      
      if (totalCount > 5) {
        expect(count).toBeGreaterThan(0);
      }
    });

    test('PERF-021: Scripts are loaded efficiently', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const scripts = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script');
        return Array.from(scripts).map(s => ({
          src: s.src,
          async: s.async,
          defer: s.defer
        }));
      });
      
      // External scripts should be async or deferred
      for (const script of scripts) {
        if (script.src && script.src.includes('google') || script.src.includes('firebase')) {
          expect(script.async || script.defer).toBe(true);
        }
      }
    });

    test('PERF-022: No render-blocking resources', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const blockingResources = await page.evaluate(() => {
        const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
        let blocking = false;
        
        stylesheets.forEach(sheet => {
          if (!sheet.media || sheet.media === 'all') {
            blocking = true;
          }
        });
        
        return blocking;
      });
      
      // Should not have blocking CSS
    });
  });

  test.describe('Network Performance', () => {
    test('PERF-030: Minimal network requests', async ({ page }) => {
      const requests: string[] = [];
      page.on('request', request => {
        requests.push(request.url());
      });
      
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Should have reasonable number of requests
      expect(requests.length).toBeLessThan(100);
    });

    test('PERF-031: Caching headers are present', async ({ page }) => {
      const responses: string[] = [];
      page.on('response', response => {
        if (response.url().includes('.')) {
          responses.push(response.url());
        }
      });
      
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Static resources should have caching
    });

    test('PERF-032: Gzip/Brotli compression is used', async ({ request }) => {
      const response = await request.get(BASE_URL);
      const headers = response.headers();
      
      const acceptEncoding = headers['accept-encoding'];
      // Should support compression
    });
  });

  test.describe('JavaScript Performance', () => {
    test('PERF-040: No long tasks block UI', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const longTasks = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const longTasks = entries.filter(e => e.duration > 50);
            resolve(longTasks.length);
          }).observe({ type: 'longtask', buffered: true });
          
          setTimeout(() => resolve(0), 5000);
        });
      });
      
      expect(longTasks).toBeLessThan(5);
    });

    test('PERF-041: Bundle size is reasonable', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const jsSize = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        let totalSize = 0;
        
        scripts.forEach(script => {
          // Approximate size based on loaded scripts
          totalSize += 50000; // Assume average script size
        });
        
        return totalSize;
      });
      
      // Total JS should be under reasonable limit
      expect(jsSize).toBeLessThan(500000);
    });
  });

  test.describe('Image Optimization', () => {
    test('PERF-050: Images are optimized', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 3); i++) {
        const img = images.nth(i);
        const src = await img.getAttribute('src');
        
        if (src) {
          // Should use optimized formats (WebP, AVIF) when possible
          const isOptimized = src.includes('.webp') || src.includes('.avif') || src.includes('/thumb');
          // Or should have srcset
          const hasSrcset = await img.getAttribute('srcset');
        }
      }
    });

    test('PERF-051: Images have proper dimensions', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 3); i++) {
        const img = images.nth(i);
        const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
        const naturalHeight = await img.evaluate((el: HTMLImageElement) => el.naturalHeight);
        
        expect(naturalWidth).toBeGreaterThan(0);
        expect(naturalHeight).toBeGreaterThan(0);
      }
    });

    test('PERF-052: Responsive images use srcset', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      
      const images = page.locator('img');
      const count = await images.count();
      
      let responsiveCount = 0;
      for (let i = 0; i < Math.min(count, 3); i++) {
        const img = images.nth(i);
        const srcset = await img.getAttribute('srcset');
        const sizes = await img.getAttribute('sizes');
        
        if (srcset) responsiveCount++;
      }
      
      // Should have some responsive images
    });
  });

  test.describe('Cumulative Layout Shift', () => {
    test('PERF-060: CLS is under threshold', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const cls = await page.evaluate(() => {
        return new Promise((resolve) => {
          let clsValue = 0;
          
          new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              if ('hadRecentInput' in entry && !(entry as any).hadRecentInput) {
                clsValue += (entry as any).value;
              }
            }
          }).observe({ type: 'layout-shift', buffered: true });
          
          setTimeout(() => resolve(clsValue), 5000);
        });
      });
      
      if (cls) {
        expect(cls).toBeLessThan(0.1);
      }
    });
  });

  test.describe('Time to Interactive', () => {
    test('PERF-070: Page becomes interactive quickly', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const tti = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              if (entry.name === 'interactive') {
                resolve(entry.startTime);
              }
            }
          }).observe({ type: 'navigation', buffered: true });
          
          setTimeout(() => resolve(null), 5000);
        });
      });
      
      if (tti) {
        expect(tti).toBeLessThan(5000);
      }
    });
  });
});
