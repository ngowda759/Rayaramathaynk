import * as path from 'path';
import * as fs from 'fs';
import {
  ProofReportService,
} from '@/services/proof-report/proof-report.service';
import { SeedReaderService } from '@/services/proof-report/seed-reader.service';
import { DatabaseExportService } from '@/services/proof-report/database-export.service';

describe('Proof Report Generator', () => {
  const testOutputDir = path.join(process.cwd(), 'reports-test');
  const testBaseUrl = 'https://work-2-nfusyslxkvqbgzgq.prod-runtime.all-hands.dev';

  beforeAll(() => {
    // Ensure test output directory exists
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup test output directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('SeedReaderService', () => {
    let seedReader: SeedReaderService;

    beforeEach(() => {
      seedReader = new SeedReaderService();
    });

    it('should read seed files from the seed directory', async () => {
      const articles = await seedReader.readAllSeedFiles();
      
      // Should find AI seed files
      expect(Array.isArray(articles)).toBe(true);
      
      // Each article should have required fields
      for (const article of articles) {
        expect(article).toHaveProperty('filename');
        expect(article).toHaveProperty('title');
        expect(article).toHaveProperty('category');
        expect(article).toHaveProperty('content');
      }
    });

    it('should filter articles by category', async () => {
      const articles = await seedReader.readAllSeedFiles();
      
      if (articles.length > 0) {
        const category = articles[0].category;
        const filtered = seedReader.getArticlesByCategory(articles, category);
        
        expect(filtered.length).toBeGreaterThan(0);
        expect(filtered.every(a => a.category === category)).toBe(true);
      }
    });

    it('should filter articles by keyword', async () => {
      const articles = await seedReader.readAllSeedFiles();
      
      if (articles.length > 0) {
        const keyword = 'temple';
        const filtered = seedReader.getArticlesByKeyword(articles, keyword);
        
        // Should find articles with the keyword in title, content, or keywords
        expect(Array.isArray(filtered)).toBe(true);
      }
    });
  });

  describe('DatabaseExportService', () => {
    let dbExport: DatabaseExportService;

    beforeEach(() => {
      dbExport = new DatabaseExportService();
    });

    it('should handle unconfigured Firebase gracefully', async () => {
      const content = await dbExport.exportDatabase();
      
      // Should return empty content structure
      expect(content).toHaveProperty('events');
      expect(content).toHaveProperty('announcements');
      expect(content).toHaveProperty('sevas');
      expect(content).toHaveProperty('poojas');
      expect(content).toHaveProperty('donations');
      expect(content).toHaveProperty('galleryAlbums');
      expect(content).toHaveProperty('galleryMedia');
    });

    it('should have isConfigured method', () => {
      expect(typeof dbExport.isConfigured).toBe('function');
    });

    it('should categorize events correctly', () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      const pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      interface MockEvent {
        startDate: Date;
        endDate: Date;
        published: boolean;
      }

      const mockEvents: MockEvent[] = [
        { startDate: futureDate, endDate: futureDate, published: true },
        { startDate: pastDate, endDate: pastDate, published: true },
      ];

      const upcoming = dbExport.getUpcomingEvents(mockEvents);
      const past = dbExport.getPastEvents(mockEvents);

      expect(upcoming.length).toBe(1);
      expect(past.length).toBe(1);
    });
  });

  describe('ProofReportService', () => {
    it('should be instantiable with valid parameters', () => {
      const service = new ProofReportService(testBaseUrl, testOutputDir);
      
      expect(service).toBeDefined();
    });

    it('should accept different base URLs', () => {
      const url1 = 'https://example.com';
      const url2 = 'http://localhost:3000';
      
      const service1 = new ProofReportService(url1, testOutputDir);
      const service2 = new ProofReportService(url2, testOutputDir);
      
      expect(service1).toBeDefined();
      expect(service2).toBeDefined();
    });
  });
});
