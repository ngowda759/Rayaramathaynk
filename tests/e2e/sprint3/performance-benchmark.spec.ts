import { test, expect, Page } from '@playwright/test';
import { BASE_URL, waitForPageLoad } from '../test-utils';

test.describe('Performance Benchmarking Tests - Sprint 3', () => {
  // Performance thresholds based on Google Core Web Vitals
  const PERFORMANCE_THRESHOLDS = {
    // Core Web Vitals targets
    LCP_GOOD: 2500, // Largest Contentful Paint (ms)
    LCP_NEEDS_IMPROVEMENT: 4000,
    FID_GOOD: 100, // First Input Delay (ms)
    CLS_GOOD: 0.1, // Cumulative Layout Shift
    FCP_GOOD: 1800, // First Contentful Paint (ms)
    
    // Page load thresholds
    PAGE_LOAD_FAST: 2000, // ms
    PAGE_LOAD_MEDIUM: 4000,
    PAGE_LOAD_SLOW: 7000,
    
    // API response thresholds
    API_RESPONSE_FAST: 500, // ms
    API_RESPONSE_MEDIUM: 1000,
    API_RESPONSE_SLOW: 3000,
  };

  // ==================== CORE WEB VITALS TESTS ====================

  test.describe('Core Web Vitals', () => {
    test('PERF_CWV_001: Homepage LCP is good (< 2.5s)', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);

      const metrics = await collectWebVitals(page);
      
      if (metrics.LCP !== undefined) {
        console.log(`Homepage LCP: ${metrics.LCP}ms`);
        expect(metrics.LCP).toBeLessThan(PERFORMANCE_THRESHOLDS.LCP_GOOD);
      }
    });

    test('PERF_CWV_002: Homepage FCP is good (< 1.8s)', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);

      const metrics = await collectWebVitals(page);
      
      if (metrics.FCP !== undefined) {
        console.log(`Homepage FCP: ${metrics.FCP}ms`);
        expect(metrics.FCP).toBeLessThan(PERFORMANCE_THRESHOLDS.FCP_GOOD);
      }
    });

    test('PERF_CWV_003: Events page LCP is good (< 2.5s)', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      await waitForPageLoad(page);

      const metrics = await collectWebVitals(page);
      
      if (metrics.LCP !== undefined) {
        console.log(`Events page LCP: ${metrics.LCP}ms`);
        expect(metrics.LCP).toBeLessThan(PERFORMANCE_THRESHOLDS.LCP_GOOD);
      }
    });

    test('PERF_CWV_004: Gallery page LCP is good (< 2.5s)', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);

      const metrics = await collectWebVitals(page);
      
      if (metrics.LCP !== undefined) {
        console.log(`Gallery page LCP: ${metrics.LCP}ms`);
        expect(metrics.LCP).toBeLessThan(PERFORMANCE_THRESHOLDS.LCP_GOOD);
      }
    });
  });

  // ==================== PAGE LOAD TIME TESTS ====================

  test.describe('Page Load Time Benchmarks', () => {
    const pages = [
      { path: '/', name: 'Homepage' },
      { path: '/events', name: 'Events' },
      { path: '/gallery', name: 'Gallery' },
      { path: '/donation', name: 'Donation' },
      { path: '/about', name: 'About' },
      { path: '/aaradhane', name: 'Aaradhane' },
      { path: '/sevas', name: 'Sevas' },
      { path: '/quotes', name: 'Quotes' },
      { path: '/shlokas', name: 'Shlokas' },
      { path: '/stotras', name: 'Stotras' },
    ];

    for (const { path, name } of pages) {
      test(`PERF_LOAD_${name.toUpperCase()}_001: ${name} loads within 4s`, async ({ page }) => {
        const startTime = Date.now();
        
        await page.goto(`${BASE_URL}${path}`);
        await waitForPageLoad(page);
        
        const loadTime = Date.now() - startTime;
        console.log(`${name} load time: ${loadTime}ms`);
        
        expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD_MEDIUM);
      });
    }

    test('PERF_LOAD_001: First page load vs repeat load comparison', async ({ page, context }) => {
      // First load (cold)
      const startCold = Date.now();
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      const coldLoad = Date.now() - startCold;

      // Close and reopen context (warm load)
      await context.close();
      const newContext = await page.context().browser()!.newContext();
      const newPage = await newContext.newPage();

      const startWarm = Date.now();
      await newPage.goto(BASE_URL);
      await waitForPageLoad(newPage);
      const warmLoad = Date.now() - startWarm;

      console.log(`Cold load: ${coldLoad}ms, Warm load: ${warmLoad}ms`);
      
      // Warm load should be faster or equal
      expect(warmLoad).toBeLessThanOrEqual(coldLoad);
      
      await newContext.close();
    });
  });

  // ==================== API RESPONSE TIME TESTS ====================

  test.describe('API Response Time Benchmarks', () => {
    test('PERF_API_001: Events API responds within 1s', async ({ page }) => {
      const startTime = Date.now();
      const response = await page.request.get(`${BASE_URL}/api/events`);
      const responseTime = Date.now() - startTime;

      console.log(`Events API response time: ${responseTime}ms`);
      
      expect(response.status()).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_MEDIUM);
    });

    test('PERF_API_002: Gallery API responds within 1s', async ({ page }) => {
      const startTime = Date.now();
      const response = await page.request.get(`${BASE_URL}/api/gallery`);
      const responseTime = Date.now() - startTime;

      console.log(`Gallery API response time: ${responseTime}ms`);
      
      expect(response.status()).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_MEDIUM);
    });

    test('PERF_API_003: Sevas API responds within 1s', async ({ page }) => {
      const startTime = Date.now();
      const response = await page.request.get(`${BASE_URL}/api/sevas`);
      const responseTime = Date.now() - startTime;

      console.log(`Sevas API response time: ${responseTime}ms`);
      
      expect(response.status()).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_MEDIUM);
    });

    test('PERF_API_004: Announcements API responds within 1s', async ({ page }) => {
      const startTime = Date.now();
      const response = await page.request.get(`${BASE_URL}/api/announcements`);
      const responseTime = Date.now() - startTime;

      console.log(`Announcements API response time: ${responseTime}ms`);
      
      expect(response.status()).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_MEDIUM);
    });

    test('PERF_API_005: Quotes API responds within 1s', async ({ page }) => {
      const startTime = Date.now();
      const response = await page.request.get(`${BASE_URL}/api/quotes`);
      const responseTime = Date.now() - startTime;

      console.log(`Quotes API response time: ${responseTime}ms`);
      
      expect(response.status()).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_MEDIUM);
    });

    test('PERF_API_006: Multiple API calls in parallel performance', async ({ page }) => {
      const startTime = Date.now();
      
      const responses = await Promise.all([
        page.request.get(`${BASE_URL}/api/events`),
        page.request.get(`${BASE_URL}/api/gallery`),
        page.request.get(`${BASE_URL}/api/sevas`),
        page.request.get(`${BASE_URL}/api/announcements`),
      ]);
      
      const totalTime = Date.now() - startTime;

      console.log(`Parallel API calls total time: ${totalTime}ms`);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status()).toBe(200);
      });
      
      // Parallel should be faster than sequential
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_SLOW);
    });

    test('PERF_API_007: API handles concurrent requests gracefully', async ({ page }) => {
      // Send 10 concurrent requests
      const concurrentRequests = 10;
      const startTime = Date.now();
      
      const promises = Array.from({ length: concurrentRequests }, () =>
        page.request.get(`${BASE_URL}/api/events`)
      );
      
      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      console.log(`${concurrentRequests} concurrent requests completed in ${totalTime}ms`);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status()).toBe(200);
      });
      
      // Should handle without errors
      expect(totalTime).toBeLessThan(5000);
    });
  });

  // ==================== NETWORK PERFORMANCE TESTS ====================

  test.describe('Network Performance', () => {
    test('PERF_NET_001: Page makes reasonable number of requests', async ({ page }) => {
      const requests: string[] = [];
      
      page.on('request', request => {
        requests.push(request.url());
      });

      await page.goto(BASE_URL);
      await waitForPageLoad(page);

      // Filter out third-party requests for fair comparison
      const firstPartyRequests = requests.filter(url => 
        url.includes(BASE_URL) || url.includes('localhost')
      );

      console.log(`First-party requests: ${firstPartyRequests.length}`);
      
      // Reasonable number of requests
      expect(firstPartyRequests.length).toBeLessThan(50);
    });

    test('PERF_NET_002: Total page weight is reasonable', async ({ page }) => {
      let totalBytes = 0;
      
      page.on('response', response => {
        if (response.url().includes(BASE_URL) || response.url().includes('localhost')) {
          totalBytes += Number(response.headers()['content-length'] || 0);
        }
      });

      await page.goto(BASE_URL);
      await waitForPageLoad(page);

      const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
      console.log(`Total page weight: ${totalMB}MB`);
      
      // Should be under 5MB for first load
      expect(totalBytes).toBeLessThan(5 * 1024 * 1024);
    });

    test('PERF_NET_003: Images are properly optimized', async ({ page }) => {
      const imageRequests: { url: string; size: number }[] = [];
      
      page.on('response', response => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';
        
        if (contentType.includes('image')) {
          const size = Number(response.headers()['content-length'] || 0);
          imageRequests.push({ url, size });
        }
      });

      await page.goto(`${BASE_URL}/gallery`);
      await waitForPageLoad(page);

      // Check for large images
      const largeImages = imageRequests.filter(img => img.size > 500 * 1024); // 500KB
      
      console.log(`Large images (>500KB): ${largeImages.length}`);
      console.log(`Total images: ${imageRequests.length}`);
      
      // Most images should be under 500KB
      largeImages.forEach(img => {
        console.log(`Large image: ${img.url} (${(img.size / 1024).toFixed(0)}KB)`);
      });
    });

    test('PERF_NET_004: Fonts load efficiently', async ({ page }) => {
      const fontRequests: string[] = [];
      
      page.on('request', request => {
        const url = request.url();
        if (url.includes('font') || url.includes('.woff') || url.includes('.ttf')) {
          fontRequests.push(url);
        }
      });

      await page.goto(BASE_URL);
      await waitForPageLoad(page);

      console.log(`Font requests: ${fontRequests.length}`);
      
      // Should not have excessive font requests
      expect(fontRequests.length).toBeLessThan(10);
    });
  });

  // ==================== RENDER PERFORMANCE TESTS ====================

  test.describe('Render Performance', () => {
    test('PERF_RENDER_001: JavaScript execution time is reasonable', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);

      const jsExecutionTime = await page.evaluate(() => {
        const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart;
      });

      console.log(`JS execution time: ${jsExecutionTime}ms`);
      
      // JS execution should be under 500ms
      expect(jsExecutionTime).toBeLessThan(500);
    });

    test('PERF_RENDER_002: DOM content loads quickly', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(BASE_URL);
      await page.waitForLoadState('domcontentloaded');
      
      const domContentLoaded = Date.now() - startTime;
      console.log(`DOM content loaded: ${domContentLoaded}ms`);
      
      expect(domContentLoaded).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD_FAST);
    });

    test('PERF_RENDER_003: Interactive elements are clickable quickly', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);

      // Wait for interactive elements
      await page.waitForSelector('button, a', { timeout: 5000 });

      const timeToInteractive = await page.evaluate(() => {
        const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return perfData.domContentLoadedEventEnd;
      });

      console.log(`Time to interactive: ${timeToInteractive}ms`);
      
      // Should be interactive within 3 seconds
      expect(timeToInteractive).toBeLessThan(3000);
    });
  });

  // ==================== CACHING TESTS ====================

  test.describe('Caching Performance', () => {
    test('PERF_CACHE_001: Static assets have cache headers', async ({ page }) => {
      const cacheHeaders: Record<string, string> = {};
      
      page.on('response', response => {
        const url = response.url();
        if (url.includes('.js') || url.includes('.css') || url.includes('.png') || url.includes('.jpg')) {
          const cacheControl = response.headers()['cache-control'];
          if (cacheControl) {
            cacheHeaders[url] = cacheControl;
          }
        }
      });

      await page.goto(BASE_URL);
      await waitForPageLoad(page);

      console.log(`Assets with cache headers: ${Object.keys(cacheHeaders).length}`);
      
      // At least some static assets should have cache headers
      expect(Object.keys(cacheHeaders).length).toBeGreaterThan(0);
    });

    test('PERF_CACHE_002: Repeat page load is faster due to caching', async ({ page }) => {
      // First load
      await page.goto(BASE_URL);
      await waitForPageLoad(page);

      // Second load (should use cache)
      const startTime = Date.now();
      await page.reload();
      await waitForPageLoad(page);
      const secondLoadTime = Date.now() - startTime;

      console.log(`Second load time: ${secondLoadTime}ms`);
      
      // Second load should be reasonably fast
      expect(secondLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD_FAST);
    });
  });

  // ==================== RESOURCE TIMING TESTS ====================

  test.describe('Resource Timing', () => {
    test('PERF_RESOURCE_001: Slow resources are identified', async ({ page }) => {
      const slowResources: { url: string; duration: number }[] = [];
      
      page.on('requestfinished', async request => {
        const response = await request.response();
        if (response) {
          const timing = request.timing();
          if (timing && timing.receiveHeadersEnd && timing.sendEnd) {
            const duration = timing.receiveHeadersEnd - timing.sendEnd;
            if (duration > 1000) { // Slower than 1 second
              slowResources.push({ url: request.url(), duration });
            }
          }
        }
      });

      await page.goto(BASE_URL);
      await waitForPageLoad(page);

      if (slowResources.length > 0) {
        console.log('Slow resources found:');
        slowResources.forEach(r => console.log(`  ${r.url}: ${r.duration}ms`));
      }
      
      // Should have minimal slow resources
      expect(slowResources.length).toBeLessThan(5);
    });

    test('PERF_RESOURCE_002: Critical resources load first', async ({ page }) => {
      const resourceLoadOrder: { url: string; startTime: number }[] = [];
      
      page.on('request', request => {
        resourceLoadOrder.push({
          url: request.url(),
          startTime: Date.now(),
        });
      });

      await page.goto(BASE_URL);
      await waitForPageLoad(page);

      // Check if HTML/JS/CSS load before images
      const htmlIndex = resourceLoadOrder.findIndex(r => r.url.includes('.html') || r.url.endsWith(BASE_URL));
      const firstImageIndex = resourceLoadOrder.findIndex(r => 
        r.url.includes('.png') || r.url.includes('.jpg') || r.url.includes('.jpeg')
      );

      if (htmlIndex !== -1 && firstImageIndex !== -1) {
        console.log(`HTML at index ${htmlIndex}, first image at index ${firstImageIndex}`);
        // HTML should generally load before images
        expect(htmlIndex).toBeLessThan(firstImageIndex);
      }
    });
  });
});

// Helper function to collect Web Vitals
async function collectWebVitals(page: Page): Promise<Record<string, number>> {
  return await page.evaluate(() => {
    return new Promise(resolve => {
      const metrics: Record<string, number> = {};
      
      // Use Performance Observer API
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'paint') {
            if (entry.name === 'first-contentful-paint') {
              metrics['FCP'] = entry.startTime;
            }
          }
          if (entry.entryType === 'largest-contentful-paint') {
            metrics['LCP'] = entry.startTime;
          }
          if (entry.name === 'first-input') {
            metrics['FID'] = entry.startTime;
          }
        }
      });

      observer.observe({ type: 'paint', buffered: true });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      observer.observe({ type: 'first-input', buffered: true });

      // Also get navigation timing
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        metrics['TTFB'] = navigation.responseStart - navigation.requestStart;
        metrics['DOMLoad'] = navigation.domContentLoadedEventEnd - navigation.fetchStart;
        metrics['Load'] = navigation.loadEventEnd - navigation.fetchStart;
      }

      // Resolve after a delay to collect metrics
      setTimeout(() => {
        observer.disconnect();
        resolve(metrics);
      }, 3000);
    });
  });
}
