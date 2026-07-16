import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

import {
  ProofReportData,
  ProofReportSummary,
  TableOfContentsItem,
  PageInfo,
  ScreenshotInfo,
} from '@/types/proof-report';

import { CrawlerService } from './crawler.service';
import { ScreenshotService } from './screenshot.service';
import { AccessibilityService } from './accessibility.service';
import { SEOService } from './seo.service';
import { LinkValidatorService } from './link-validator.service';
import { ImageValidatorService } from './image-validator.service';
import { ContentQualityService } from './content-quality.service';
import { TempleValidatorService } from './temple-validator.service';
import { DatabaseExportService } from './database-export.service';
import { SeedReaderService } from './seed-reader.service';
import { HtmlGeneratorService } from './html-generator.service';
import { PdfGeneratorService } from './pdf-generator.service';

export class ProofReportService {
  private baseUrl: string;
  private outputDir: string;
  private screenshotsDir: string;
  
  private crawlerService: CrawlerService;
  private screenshotService: ScreenshotService;
  private accessibilityService: AccessibilityService;
  private seoService: SEOService;
  private linkValidatorService: LinkValidatorService;
  private imageValidatorService: ImageValidatorService;
  private contentQualityService: ContentQualityService;
  private templeValidatorService: TempleValidatorService;
  private databaseExportService: DatabaseExportService;
  private seedReaderService: SeedReaderService;
  private htmlGeneratorService: HtmlGeneratorService;
  private pdfGeneratorService: PdfGeneratorService;

  constructor(baseUrl: string, outputDir: string) {
    this.baseUrl = baseUrl;
    this.outputDir = outputDir;
    this.screenshotsDir = path.join(outputDir, 'screenshots');

    // Initialize services
    this.crawlerService = new CrawlerService(baseUrl);
    this.screenshotService = new ScreenshotService(this.screenshotsDir);
    this.accessibilityService = new AccessibilityService();
    this.seoService = new SEOService();
    this.linkValidatorService = new LinkValidatorService();
    this.imageValidatorService = new ImageValidatorService();
    this.contentQualityService = new ContentQualityService();
    this.templeValidatorService = new TempleValidatorService();
    this.databaseExportService = new DatabaseExportService();
    this.seedReaderService = new SeedReaderService();
    this.htmlGeneratorService = new HtmlGeneratorService(outputDir);
    this.pdfGeneratorService = new PdfGeneratorService();
  }

  async generate(): Promise<string> {
    console.log('[ProofReportService] Starting proof report generation...');
    console.log(`[ProofReportService] Base URL: ${this.baseUrl}`);
    console.log(`[ProofReportService] Output directory: ${this.outputDir}`);

    // Ensure output directories exist
    this.ensureDirectories();

    // Initialize all services
    console.log('[ProofReportService] Initializing services...');
    await this.crawlerService.initialize();
    await this.screenshotService.initialize();
    await this.accessibilityService.initialize();
    await this.seoService.initialize();
    await this.pdfGeneratorService.initialize();

    try {
      // Step 1: Discover and crawl pages
      console.log('[ProofReportService] Discovering public routes...');
      const routes = await this.crawlerService.discoverPublicRoutes();
      console.log(`[ProofReportService] Found ${routes.length} routes`);

      console.log('[ProofReportService] Crawling pages...');
      const pages: PageInfo[] = [];
      for (const route of routes) {
        try {
          console.log(`  Crawling: ${route}`);
          const pageInfo = await this.crawlerService.crawlPage(route);
          pages.push(pageInfo);
        } catch (error) {
          console.error(`  Failed to crawl ${route}:`, error);
        }
      }
      console.log(`[ProofReportService] Crawled ${pages.length} pages`);

      // Step 2: Take screenshots
      console.log('[ProofReportService] Taking screenshots...');
      const screenshots = await this.screenshotService.takeMultipleScreenshots(routes);
      console.log(`[ProofReportService] Captured ${screenshots.length} screenshots`);

      // Step 3: Run validations
      console.log('[ProofReportService] Running accessibility checks...');
      const accessibilityIssues = await this.accessibilityService.checkAllPages(pages);

      console.log('[ProofReportService] Running SEO checks...');
      const seoIssues = await this.seoService.checkAllPages(pages);

      console.log('[ProofReportService] Validating links...');
      const linkValidation = await this.linkValidatorService.validateLinks(pages);

      console.log('[ProofReportService] Validating images...');
      const imageValidation = await this.imageValidatorService.validateImages(pages);

      console.log('[ProofReportService] Checking content quality...');
      const contentQualityIssues = await this.contentQualityService.checkPages(pages);

      // Step 4: Export database content
      console.log('[ProofReportService] Exporting database content...');
      const databaseContent = await this.databaseExportService.exportDatabase();

      // Step 5: Read AI seed files
      console.log('[ProofReportService] Reading AI seed files...');
      const seedArticles = await this.seedReaderService.readAllSeedFiles();
      console.log(`[ProofReportService] Found ${seedArticles.length} AI articles`);

      // Step 6: Temple validation
      console.log('[ProofReportService] Running temple-specific validation...');
      const templeValidationIssues = await this.templeValidatorService.validate(pages, databaseContent);

      // Step 7: Calculate summary
      const summary = this.calculateSummary(
        pages,
        screenshots,
        databaseContent,
        seedArticles,
        accessibilityIssues,
        seoIssues,
        linkValidation,
        imageValidation,
        contentQualityIssues,
        templeValidationIssues
      );

      // Step 8: Build table of contents
      const tableOfContents = this.buildTableOfContents();

      // Step 9: Build report data
      const reportData: ProofReportData = {
        summary,
        pages,
        screenshots,
        accessibilityIssues,
        seoIssues,
        linkValidation,
        imageValidation,
        contentQualityIssues,
        templeValidationIssues,
        seedArticles,
        databaseContent,
        tableOfContents,
      };

      // Step 10: Generate HTML report
      console.log('[ProofReportService] Generating HTML report...');
      const htmlPath = await this.htmlGeneratorService.generate(reportData);
      console.log(`[ProofReportService] HTML report saved to: ${htmlPath}`);

      // Step 11: Generate PDF
      console.log('[ProofReportService] Generating PDF report...');
      const pdfPath = path.join(this.outputDir, 'proof-report.pdf');
      await this.pdfGeneratorService.generate(reportData, htmlPath, pdfPath);
      console.log(`[ProofReportService] PDF report saved to: ${pdfPath}`);

      console.log('[ProofReportService] Proof report generation complete!');
      console.log(`[ProofReportService] Reports saved to: ${this.outputDir}`);

      return pdfPath;
    } finally {
      // Cleanup services
      await this.crawlerService.close();
      await this.screenshotService.close();
      await this.accessibilityService.close();
      await this.seoService.close();
      await this.pdfGeneratorService.close();
    }
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  private calculateSummary(
    pages: PageInfo[],
    screenshots: ScreenshotInfo[],
    databaseContent: any,
    seedArticles: any[],
    accessibilityIssues: any[],
    seoIssues: any[],
    linkValidation: any[],
    imageValidation: any[],
    contentQualityIssues: any[],
    templeValidationIssues: any[]
  ): ProofReportSummary {
    const errors = [
      ...accessibilityIssues.filter((i: any) => i.severity === 'error'),
      ...seoIssues.filter((i: any) => i.severity === 'error'),
      ...linkValidation.filter((l: any) => l.status === 'broken'),
      ...imageValidation.filter((i: any) => i.status === 'broken'),
      ...contentQualityIssues.filter((i: any) => i.severity === 'error'),
      ...templeValidationIssues.filter((i: any) => i.severity === 'error'),
    ].length;

    const warnings = [
      ...accessibilityIssues.filter((i: any) => i.severity === 'warning'),
      ...seoIssues.filter((i: any) => i.severity === 'warning'),
      ...contentQualityIssues.filter((i: any) => i.severity === 'warning'),
      ...templeValidationIssues.filter((i: any) => i.severity === 'warning'),
    ].length;

    let gitCommitHash: string | undefined;
    try {
      gitCommitHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      // Git not available
    }

    return {
      totalPages: pages.length,
      totalEvents: databaseContent.events?.length || 0,
      totalSevas: databaseContent.sevas?.length || 0,
      totalGalleryAlbums: databaseContent.galleryAlbums?.length || 0,
      totalGalleryImages: databaseContent.galleryMedia?.length || 0,
      totalAnnouncements: databaseContent.announcements?.length || 0,
      totalAIArticles: seedArticles.length,
      totalScreenshots: screenshots.length,
      brokenLinks: linkValidation.filter((l: any) => l.status === 'broken').length,
      missingImages: imageValidation.filter((i: any) => i.status === 'broken').length,
      seoIssues: seoIssues.length,
      accessibilityIssues: accessibilityIssues.length,
      warnings,
      errors,
      generationDate: new Date(),
      gitCommitHash,
      environment: process.env.NODE_ENV || 'development',
    };
  }

  private buildTableOfContents(): TableOfContentsItem[] {
    return [
      { title: 'Summary Dashboard', level: 1, pageNumber: 1, anchor: 'summary' },
      { title: 'Website Pages', level: 1, pageNumber: 2, anchor: 'pages' },
      { title: 'Accessibility Issues', level: 1, pageNumber: 3, anchor: 'accessibility' },
      { title: 'SEO Issues', level: 1, pageNumber: 4, anchor: 'seo' },
      { title: 'Link Validation', level: 1, pageNumber: 5, anchor: 'links' },
      { title: 'Image Validation', level: 1, pageNumber: 6, anchor: 'images' },
      { title: 'Content Quality', level: 1, pageNumber: 7, anchor: 'content-quality' },
      { title: 'Temple-Specific Validation', level: 1, pageNumber: 8, anchor: 'temple-validation' },
      { title: 'AI Knowledge Base', level: 1, pageNumber: 9, anchor: 'ai-knowledge' },
      { title: 'Database Content', level: 1, pageNumber: 10, anchor: 'database' },
    ];
  }
}
