import { chromium, Browser } from 'playwright';
import {
  SEOIssue,
  PageInfo,
} from '@/types/proof-report';

export class SEOService {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async checkPage(pageInfo: PageInfo): Promise<SEOIssue[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const context = await this.browser.newContext();
    const page = await context.newPage();
    const issues: SEOIssue[] = [];
    
    try {
      await page.goto(pageInfo.url, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Get page data
      const title = await page.locator('title').textContent();
      const metaDescription = await page.locator('meta[name="description"]').getAttribute('content');
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
      const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content');
      const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      
      // Check for missing title
      if (!title || title.trim() === '') {
        issues.push({
          type: 'missing-title',
          pageUrl: pageInfo.url,
          severity: 'error',
          message: 'Page missing title tag',
        });
      }

      // Check for missing meta description
      if (!metaDescription || metaDescription.trim() === '') {
        issues.push({
          type: 'missing-meta-description',
          pageUrl: pageInfo.url,
          severity: 'error',
          message: 'Page missing meta description',
        });
      }

      // Check for missing Open Graph tags
      if (!ogTitle) {
        issues.push({
          type: 'missing-og',
          pageUrl: pageInfo.url,
          severity: 'warning',
          message: 'Missing Open Graph title (og:title)',
        });
      }
      
      if (!ogDescription) {
        issues.push({
          type: 'missing-og',
          pageUrl: pageInfo.url,
          severity: 'warning',
          message: 'Missing Open Graph description (og:description)',
        });
      }
      
      if (!ogImage) {
        issues.push({
          type: 'missing-og',
          pageUrl: pageInfo.url,
          severity: 'warning',
          message: 'Missing Open Graph image (og:image)',
        });
      }

      // Check for canonical URL issues
      if (canonical) {
        const canonicalUrl = new URL(canonical);
        const pageUrl = new URL(pageInfo.url);
        
        if (canonicalUrl.hostname !== pageUrl.hostname) {
          issues.push({
            type: 'canonical-issue',
            pageUrl: pageInfo.url,
            severity: 'warning',
            message: `Canonical URL hostname mismatch: ${canonical}`,
          });
        }
      }

      // Check for large images
      const images = await page.locator('img').all();
      for (const img of images) {
        const naturalWidth = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
        const naturalHeight = await img.evaluate((el) => (el as HTMLImageElement).naturalHeight);
        
        // Flag images larger than 2000px in either dimension
        if (naturalWidth > 2000 || naturalHeight > 2000) {
          const src = await img.getAttribute('src') || '';
          issues.push({
            type: 'large-image',
            pageUrl: pageInfo.url,
            severity: 'warning',
            message: `Large image (${naturalWidth}x${naturalHeight}): ${src}`,
          });
        }
      }

    } finally {
      await context.close();
    }

    return issues;
  }

  async checkAllPages(pages: PageInfo[]): Promise<SEOIssue[]> {
    const allIssues: SEOIssue[] = [];
    const titles: Map<string, string> = new Map();
    
    // First pass: collect all titles for duplicate check
    for (const page of pages) {
      if (page.metaTitle) {
        titles.set(page.url, page.metaTitle);
      }
    }
    
    // Second pass: check pages and find duplicates
    const titleCounts: Record<string, string[]> = {};
    for (const [url, title] of titles.entries()) {
      if (titleCounts[title]) {
        titleCounts[title].push(url);
      } else {
        titleCounts[title] = [url];
      }
    }
    
    // Add duplicate title issues
    for (const [title, urls] of Object.entries(titleCounts)) {
      if (urls.length > 1 && title) {
        for (const url of urls) {
          allIssues.push({
            type: 'duplicate-title',
            pageUrl: url,
            severity: 'warning',
            message: `Duplicate title "${title}" found on ${urls.length} pages`,
          });
        }
      }
    }
    
    // Check individual pages for other SEO issues
    for (const page of pages) {
      try {
        const issues = await this.checkPage(page);
        allIssues.push(...issues);
      } catch (error) {
        console.error(`Failed to check SEO for ${page.url}:`, error);
      }
    }

    return allIssues;
  }
}
