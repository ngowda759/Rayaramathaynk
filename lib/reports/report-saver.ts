/**
 * Report Saver Utility
 * Captures screenshots and exports pages as PDF, then saves them to Vercel Blob storage
 */

import { Page, Browser } from '@playwright/test';

export interface ReportMetadata {
  page?: string;
  url?: string;
  timestamp?: string;
  testName?: string;
  userAgent?: string;
}

export interface SaveReportResponse {
  success: boolean;
  url: string;
  pathname: string;
  type: 'screenshot' | 'pdf';
}

/**
 * Save a report (screenshot or PDF) to Vercel Blob storage via API
 */
async function saveToBlobStorage(
  type: 'screenshot' | 'pdf',
  name: string,
  content: string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<SaveReportResponse> {
  const response = await fetch('/api/reports/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type,
      name,
      content,
      contentType,
      metadata: {
        ...metadata,
        savedAt: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save report');
  }

  return response.json();
}

/**
 * Wait for page to fully load all dynamic content
 */
async function waitForPageReady(page: Page, waitTime: number = 3000): Promise<void> {
  // Wait for network to be idle (no requests for 500ms)
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
    // If networkidle times out, continue anyway
  });
  
  // Wait for all images to load
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );
  });
  
  // Additional wait for React/Next.js to hydrate
  await page.waitForTimeout(waitTime);
  
  // Scroll through the page to trigger lazy loading
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 50);
    });
  });
}

/**
 * Capture a screenshot of a page and save to Vercel Blob storage
 */
export async function captureAndSaveScreenshot(
  page: Page,
  name: string,
  options?: {
    metadata?: ReportMetadata;
    screenshotOptions?: Parameters<typeof page.screenshot>[0];
    waitBeforeCapture?: number;
  }
): Promise<SaveReportResponse> {
  // Wait for page to be ready
  await waitForPageReady(page, options?.waitBeforeCapture ?? 3000);
  
  // Take screenshot
  const screenshotBuffer = await page.screenshot({
    fullPage: options?.screenshotOptions?.fullPage ?? true,
    type: 'png',
    ...options?.screenshotOptions,
  });

  // Convert to base64
  const base64Screenshot = Buffer.from(screenshotBuffer).toString('base64');
  const dataUrl = `data:image/png;base64,${base64Screenshot}`;

  // Save to blob storage
  return saveToBlobStorage(
    'screenshot',
    name,
    dataUrl,
    'image/png',
    options?.metadata ? {
      page: options.metadata.page || name,
      url: options.metadata.url || page.url(),
      timestamp: options.metadata.timestamp || new Date().toISOString(),
      testName: options.metadata.testName || '',
      userAgent: await page.evaluate(() => navigator.userAgent),
    } : undefined
  );
}

/**
 * Export a page as PDF and save to Vercel Blob storage
 */
export async function exportAndSavePdf(
  page: Page,
  name: string,
  options?: {
    metadata?: ReportMetadata;
    pdfOptions?: Parameters<typeof page.pdf>[0];
    waitBeforeCapture?: number;
  }
): Promise<SaveReportResponse> {
  // Wait for page to be ready
  await waitForPageReady(page, options?.waitBeforeCapture ?? 3000);
  
  // Export as PDF
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    ...options?.pdfOptions,
  });

  // Convert to base64
  const base64Pdf = Buffer.from(pdfBuffer).toString('base64');

  // Save to blob storage
  return saveToBlobStorage(
    'pdf',
    name,
    base64Pdf,
    'application/pdf',
    options?.metadata ? {
      page: options.metadata.page || name,
      url: options.metadata.url || page.url(),
      timestamp: options.metadata.timestamp || new Date().toISOString(),
      testName: options.metadata.testName || '',
      userAgent: await page.evaluate(() => navigator.userAgent),
    } : undefined
  );
}

/**
 * Capture both screenshot and PDF of a page and save both to Vercel Blob storage
 */
export async function captureFullReport(
  page: Page,
  name: string,
  options?: {
    metadata?: ReportMetadata;
    screenshotOptions?: Parameters<typeof page.screenshot>[0];
    pdfOptions?: Parameters<typeof page.pdf>[0];
  }
): Promise<{ screenshot: SaveReportResponse; pdf: SaveReportResponse }> {
  const metadata = options?.metadata || {};

  const [screenshot, pdf] = await Promise.all([
    captureAndSaveScreenshot(page, `${name}-screenshot`, {
      metadata,
      screenshotOptions: options?.screenshotOptions,
    }),
    exportAndSavePdf(page, `${name}-pdf`, {
      metadata,
      pdfOptions: options?.pdfOptions,
    }),
  ]);

  return { screenshot, pdf };
}

/**
 * Report Saver class for use in Playwright tests
 */
export class ReportSaver {
  private page: Page;
  private reportPrefix: string;

  constructor(page: Page, reportPrefix: string = 'playwright-report') {
    this.page = page;
    this.reportPrefix = reportPrefix;
  }

  /**
   * Take a screenshot and save to blob storage
   */
  async saveScreenshot(
    name: string,
    metadata?: ReportMetadata
  ): Promise<SaveReportResponse> {
    const fullName = `${this.reportPrefix}-${name}`;
    return captureAndSaveScreenshot(this.page, fullName, {
      metadata: {
        ...metadata,
        testName: this.reportPrefix,
        url: this.page.url(),
      },
    });
  }

  /**
   * Export page as PDF and save to blob storage
   */
  async savePdf(
    name: string,
    metadata?: ReportMetadata
  ): Promise<SaveReportResponse> {
    const fullName = `${this.reportPrefix}-${name}`;
    return exportAndSavePdf(this.page, fullName, {
      metadata: {
        ...metadata,
        testName: this.reportPrefix,
        url: this.page.url(),
      },
    });
  }

  /**
   * Save both screenshot and PDF
   */
  async saveFullReport(
    name: string,
    metadata?: ReportMetadata
  ): Promise<{ screenshot: SaveReportResponse; pdf: SaveReportResponse }> {
    const fullName = `${this.reportPrefix}-${name}`;
    return captureFullReport(this.page, fullName, {
      metadata: {
        ...metadata,
        testName: this.reportPrefix,
        url: this.page.url(),
      },
    });
  }

  /**
   * Get the current page URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }
}

/**
 * Helper function to create a ReportSaver instance
 */
export function createReportSaver(page: Page, prefix?: string): ReportSaver {
  return new ReportSaver(page, prefix);
}
