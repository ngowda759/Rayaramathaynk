/**
 * Standalone script to save web page screenshots and PDFs to Vercel Blob storage
 * 
 * Usage:
 *   npx tsx scripts/save-report.ts --url <url> --name <name> --type <screenshot|pdf|both>
 * 
 * Example:
 *   npx tsx scripts/save-report.ts --url http://localhost:3000 --name homepage --type both
 */

import { chromium, Browser, Page } from 'playwright';

interface SaveReportOptions {
  url: string;
  name: string;
  type: 'screenshot' | 'pdf' | 'both';
  viewport?: { width: number; height: number };
}

async function saveReportToBlob(
  type: 'screenshot' | 'pdf',
  name: string,
  content: string,
  contentType: string
): Promise<{ success: boolean; url: string }> {
  const response = await fetch('http://localhost:3000/api/reports/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      name,
      content,
      contentType,
      metadata: {
        savedAt: new Date().toISOString(),
        source: 'save-report-script',
      },
    }),
  });

  return response.json();
}

async function captureScreenshot(page: Page, name: string): Promise<string> {
  const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
  return `data:image/png;base64,${Buffer.from(screenshot).toString('base64')}`;
}

async function exportPdf(page: Page, name: string): Promise<string> {
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
  });
  return Buffer.from(pdf).toString('base64');
}

async function main() {
  const args = process.argv.slice(2);
  const options: SaveReportOptions = {
    url: 'http://localhost:3000',
    name: 'report',
    type: 'both',
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      options.url = args[i + 1];
      i++;
    } else if (args[i] === '--name' && args[i + 1]) {
      options.name = args[i + 1];
      i++;
    } else if (args[i] === '--type' && args[i + 1]) {
      options.type = args[i + 1] as 'screenshot' | 'pdf' | 'both';
      i++;
    } else if (args[i] === '--width' && args[i + 1]) {
      options.viewport = {
        width: parseInt(args[i + 1]),
        height: options.viewport?.height || 1080,
      };
      i++;
    } else if (args[i] === '--height' && args[i + 1]) {
      options.viewport = {
        width: options.viewport?.width || 1920,
        height: parseInt(args[i + 1]),
      };
      i++;
    }
  }

  console.log('='.repeat(60));
  console.log('Saving Report to Vercel Blob Storage');
  console.log('='.repeat(60));
  console.log(`URL: ${options.url}`);
  console.log(`Name: ${options.name}`);
  console.log(`Type: ${options.type}`);
  if (options.viewport) {
    console.log(`Viewport: ${options.viewport.width}x${options.viewport.height}`);
  }
  console.log('='.repeat(60));

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: options.viewport || { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    console.log('\n🌐 Navigating to page...');
    await page.goto(options.url, { waitUntil: 'networkidle' });
    console.log('✅ Page loaded successfully');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (options.type === 'screenshot' || options.type === 'both') {
      console.log('\n📸 Capturing screenshot...');
      const screenshotData = await captureScreenshot(page, options.name);
      console.log('💾 Saving screenshot to blob storage...');
      const screenshotResult = await saveReportToBlob(
        'screenshot',
        `${options.name}_${timestamp}`,
        screenshotData,
        'image/png'
      );
      if (screenshotResult.success) {
        console.log(`✅ Screenshot saved: ${screenshotResult.url}`);
      } else {
        console.log('❌ Failed to save screenshot');
      }
    }

    if (options.type === 'pdf' || options.type === 'both') {
      console.log('\n📄 Exporting page as PDF...');
      const pdfData = await exportPdf(page, options.name);
      console.log('💾 Saving PDF to blob storage...');
      const pdfResult = await saveReportToBlob(
        'pdf',
        `${options.name}_${timestamp}`,
        pdfData,
        'application/pdf'
      );
      if (pdfResult.success) {
        console.log(`✅ PDF saved: ${pdfResult.url}`);
      } else {
        console.log('❌ Failed to save PDF');
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Report saved successfully!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();
