import { chromium, Browser } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { ScreenshotInfo } from '@/types/proof-report';

export class ScreenshotService {
  private browser: Browser | null = null;
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async initialize(): Promise<void> {
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    this.browser = await chromium.launch({ headless: true });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async takeScreenshot(pageUrl: string): Promise<ScreenshotInfo> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    
    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Generate filename from URL
      const urlObj = new URL(pageUrl);
      const pathSegments = urlObj.pathname.split('/').filter(s => s);
      const filename = pathSegments.length > 0 
        ? pathSegments.join('-') || 'home' 
        : 'home';
      
      const screenshotFilename = `${filename}-${Date.now()}.png`;
      const screenshotPath = path.join(this.outputDir, screenshotFilename);
      
      // Take full-page screenshot
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });

      return {
        pageUrl,
        screenshotPath,
        timestamp: new Date(),
      };
    } finally {
      await context.close();
    }
  }

  async takeMultipleScreenshots(pageUrls: string[]): Promise<ScreenshotInfo[]> {
    const screenshots: ScreenshotInfo[] = [];
    
    for (const pageUrl of pageUrls) {
      try {
        const screenshot = await this.takeScreenshot(pageUrl);
        screenshots.push(screenshot);
      } catch (error) {
        console.error(`Failed to take screenshot for ${pageUrl}:`, error);
      }
    }
    
    return screenshots;
  }
}
