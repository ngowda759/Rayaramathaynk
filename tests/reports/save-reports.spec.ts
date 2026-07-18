/**
 * Example Playwright Test - Saving Screenshots and PDFs to Vercel Blob Storage
 * 
 * This test demonstrates how to capture screenshots and export pages as PDF,
 * then save them to Vercel Blob storage under the 'reports' folder.
 * 
 * Usage:
 *   npx playwright test tests/reports/save-reports.spec.ts
 */

import { test, expect } from '@playwright/test';
import { 
  captureAndSaveScreenshot, 
  exportAndSavePdf, 
  captureFullReport,
  ReportSaver,
  ReportMetadata 
} from '@/lib/reports/report-saver';

// Base URL for testing - can be overridden via environment variable
const BASE_URL = process.env.E2E_TEST_URL || 'http://localhost:3000';

/**
 * Example 1: Basic screenshot capture and save
 */
test('capture and save screenshot to blob storage', async ({ page }) => {
  await page.goto(`${BASE_URL}/`);
  
  const metadata: ReportMetadata = {
    page: 'homepage',
    testName: 'homepage-screenshot-test',
  };

  const result = await captureAndSaveScreenshot(page, 'homepage', { metadata });
  
  expect(result.success).toBe(true);
  expect(result.url).toContain('reports/screenshot/');
  expect(result.type).toBe('screenshot');
  
  console.log('Screenshot saved to:', result.url);
});

/**
 * Example 2: Export page as PDF and save
 */
test('export page as PDF and save to blob storage', async ({ page }) => {
  await page.goto(`${BASE_URL}/admin`);
  
  const metadata: ReportMetadata = {
    page: 'admin-dashboard',
    testName: 'admin-pdf-export-test',
  };

  const result = await exportAndSavePdf(page, 'admin-dashboard', { metadata });
  
  expect(result.success).toBe(true);
  expect(result.url).toContain('reports/pdf/');
  expect(result.type).toBe('pdf');
  
  console.log('PDF saved to:', result.url);
});

/**
 * Example 3: Capture both screenshot and PDF
 */
test('capture full report (screenshot + PDF) for homepage', async ({ page }) => {
  await page.goto(`${BASE_URL}/`);
  
  const metadata: ReportMetadata = {
    page: 'homepage',
    testName: 'full-homepage-report',
  };

  const results = await captureFullReport(page, 'homepage', { metadata });
  
  expect(results.screenshot.success).toBe(true);
  expect(results.screenshot.url).toContain('reports/screenshot/');
  
  expect(results.pdf.success).toBe(true);
  expect(results.pdf.url).toContain('reports/pdf/');
  
  console.log('Screenshot saved to:', results.screenshot.url);
  console.log('PDF saved to:', results.pdf.url);
});

/**
 * Example 4: Using ReportSaver class for cleaner test code
 */
test.describe('using ReportSaver class', () => {
  test('save multiple reports with ReportSaver', async ({ page }) => {
    const reportSaver = new ReportSaver(page, 'e2e-test');
    
    // Visit homepage
    await page.goto(`${BASE_URL}/`);
    
    // Save screenshot
    const screenshot = await reportSaver.saveScreenshot('homepage');
    expect(screenshot.success).toBe(true);
    console.log('Homepage screenshot:', screenshot.url);
    
    // Save PDF
    const pdf = await reportSaver.savePdf('homepage');
    expect(pdf.success).toBe(true);
    console.log('Homepage PDF:', pdf.url);
    
    // Visit admin page
    await page.goto(`${BASE_URL}/admin`);
    
    // Save full report (screenshot + PDF)
    const fullReport = await reportSaver.saveFullReport('admin-dashboard');
    expect(fullReport.screenshot.success).toBe(true);
    expect(fullReport.pdf.success).toBe(true);
    console.log('Admin dashboard screenshot:', fullReport.screenshot.url);
    console.log('Admin dashboard PDF:', fullReport.pdf.url);
  });
});

/**
 * Example 5: Save report with custom screenshot options
 */
test('capture full-page screenshot with custom options', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${BASE_URL}/`);
  
  const result = await captureAndSaveScreenshot(page, 'homepage-fullpage', {
    metadata: {
      page: 'homepage',
      testName: 'fullpage-screenshot-test',
    },
    screenshotOptions: {
      fullPage: true,
      type: 'png',
    },
  });
  
  expect(result.success).toBe(true);
  console.log('Full-page screenshot saved to:', result.url);
});

/**
 * Example 6: Save report with custom PDF options
 */
test('export page as PDF with custom options', async ({ page }) => {
  await page.goto(`${BASE_URL}/`);
  
  const result = await exportAndSavePdf(page, 'homepage-landscape', {
    metadata: {
      page: 'homepage',
      testName: 'pdf-export-test',
    },
    pdfOptions: {
      format: 'A4',
      landscape: true,
      printBackground: true,
    },
  });
  
  expect(result.success).toBe(true);
  console.log('Landscape PDF saved to:', result.url);
});

/**
 * Example 7: List saved reports from blob storage
 */
test('list all saved reports', async ({ page }) => {
  const response = await page.request.get('/api/reports/list');
  const data = await response.json();
  
  expect(data.success).toBe(true);
  expect(Array.isArray(data.reports)).toBe(true);
  
  console.log(`Found ${data.count} reports in storage:`);
  data.reports.forEach((report: { url: string; pathname: string }) => {
    console.log(`  - ${report.pathname}: ${report.url}`);
  });
});
