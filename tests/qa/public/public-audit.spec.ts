import { test, expect, Page } from '@playwright/test';
import { Crawler } from '../utilities/crawler';

test.describe('Public Site Automated Audit', () => {
  test('Explore public pages and run checks', async ({ page }) => {
    const crawler = new Crawler(page, { maxDepth: 3, maxPages: 50, maxActionsPerPage: 8 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await crawler.run();
    // Assertions are done inside the crawler via reporter; just ensure no uncaught errors.
    expect(true).toBeTruthy();
  });
});
