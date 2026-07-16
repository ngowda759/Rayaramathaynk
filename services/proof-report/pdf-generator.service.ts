import * as path from 'path';
import { chromium, Browser } from 'playwright';
import {
  ProofReportData,
} from '@/types/proof-report';

export class PdfGeneratorService {
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

  async generate(data: ProofReportData, htmlPath: string, outputPath: string): Promise<string> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    try {
      // Navigate to the HTML file
      const absoluteHtmlPath = path.resolve(htmlPath);
      await page.goto(`file://${absoluteHtmlPath}`, { waitUntil: 'networkidle' });

      // Generate PDF
      await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="width: 100%; text-align: center; font-size: 10px; color: #666;">
            Content Proof Report - Sri Raghavendra Swamy Math
          </div>
        `,
        footerTemplate: `
          <div style="width: 100%; text-align: center; font-size: 10px; color: #666;">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span>
          </div>
        `,
      });

      return outputPath;
    } finally {
      await context.close();
    }
  }
}
