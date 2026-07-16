import { chromium, Browser } from 'playwright';
import {
  AccessibilityIssue,
  PageInfo,
} from '@/types/proof-report';

export class AccessibilityService {
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

  async checkPage(pageInfo: PageInfo): Promise<AccessibilityIssue[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const context = await this.browser.newContext();
    const page = await context.newPage();
    const issues: AccessibilityIssue[] = [];
    
    try {
      await page.goto(pageInfo.url, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Check for images without alt text
      const imagesWithoutAlt = await page.locator('img:not([alt])').all();
      for (const img of imagesWithoutAlt) {
        const src = await img.getAttribute('src') || '';
        issues.push({
          type: 'missing-alt',
          pageUrl: pageInfo.url,
          element: src,
          severity: 'error',
          message: `Image missing alt text: ${src}`,
        });
      }

      // Check for decorative images without empty alt
      const decorativeImages = await page.locator('img[alt=""]').all();
      for (const img of decorativeImages) {
        const src = await img.getAttribute('src') || '';
        // Only flag if not truly decorative (no role="presentation" or aria-hidden)
        const role = await img.getAttribute('role');
        const ariaHidden = await img.getAttribute('aria-hidden');
        if (role !== 'presentation' && ariaHidden !== 'true') {
          issues.push({
            type: 'missing-alt',
            pageUrl: pageInfo.url,
            element: src,
            severity: 'warning',
            message: `Image may be missing meaningful alt text: ${src}`,
          });
        }
      }

      // Check for empty headings
      const emptyHeadingsCount = await page.locator('h1:empty, h2:empty, h3:empty, h4:empty, h5:empty, h6:empty').count();
      if (emptyHeadingsCount > 0) {
        issues.push({
          type: 'empty-heading',
          pageUrl: pageInfo.url,
          severity: 'error',
          message: `Found ${emptyHeadingsCount} empty heading(s)`,
        });
      }

      // Check for duplicate headings
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
      const headingCounts: Record<string, number> = {};
      for (const heading of headings) {
        const trimmed = heading.trim();
        if (trimmed) {
          headingCounts[trimmed] = (headingCounts[trimmed] || 0) + 1;
        }
      }
      for (const [heading, count] of Object.entries(headingCounts)) {
        if (count > 1) {
          issues.push({
            type: 'duplicate-heading',
            pageUrl: pageInfo.url,
            severity: 'warning',
            message: `Duplicate heading found "${heading}" (${count} times)`,
          });
        }
      }

      // Check for very long paragraphs
      const paragraphs = await page.locator('p').all();
      for (const p of paragraphs) {
        const text = await p.textContent();
        if (text && text.length > 1000) {
          issues.push({
            type: 'long-paragraph',
            pageUrl: pageInfo.url,
            severity: 'warning',
            message: `Very long paragraph (${text.length} characters) found`,
          });
        }
      }

      // Check for broken anchors (empty href or #)
      const brokenAnchors = await page.locator('a[href="#"], a[href=""]:not([href*="/"]), a:not([href])').all();
      for (const anchor of brokenAnchors) {
        const href = await anchor.getAttribute('href') || '';
        const text = await anchor.textContent() || '';
        issues.push({
          type: 'broken-anchor',
          pageUrl: pageInfo.url,
          element: text || href,
          severity: 'warning',
          message: `Potentially broken anchor: ${href || '(no href)'}`,
        });
      }

      // Check for missing labels on form inputs
      const inputsWithoutLabels = await page.locator('input:not([aria-label]):not([aria-labelledby])').all();
      for (const input of inputsWithoutLabels) {
        const id = await input.getAttribute('id');
        const type = await input.getAttribute('type') || 'text';
        
        // Skip hidden inputs
        if (type === 'hidden') continue;
        
        // Check if there's a label with matching for attribute
        if (id) {
          const label = await page.locator(`label[for="${id}"]`).count();
          if (label === 0) {
            issues.push({
              type: 'missing-label',
              pageUrl: pageInfo.url,
              element: id,
              severity: 'warning',
              message: `Input field missing label: ${id}`,
            });
          }
        }
      }

    } finally {
      await context.close();
    }

    return issues;
  }

  async checkAllPages(pages: PageInfo[]): Promise<AccessibilityIssue[]> {
    const allIssues: AccessibilityIssue[] = [];
    
    for (const page of pages) {
      try {
        const issues = await this.checkPage(page);
        allIssues.push(...issues);
      } catch (error) {
        console.error(`Failed to check accessibility for ${page.url}:`, error);
      }
    }

    return allIssues;
  }
}
