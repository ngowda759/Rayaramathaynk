import * as fs from 'fs';
import * as path from 'path';
import { SeedArticle } from '@/types/proof-report';

export class SeedReaderService {
  private seedDir: string;

  constructor(seedDir: string = path.join(process.cwd(), 'seed')) {
    this.seedDir = seedDir;
  }

  async readAllSeedFiles(): Promise<SeedArticle[]> {
    const articles: SeedArticle[] = [];

    try {
      // Check if seed directory exists
      if (!fs.existsSync(this.seedDir)) {
        console.log('[SeedReaderService] Seed directory not found:', this.seedDir);
        return articles;
      }

      // Read AI seed files
      const aiDir = path.join(this.seedDir, 'ai');
      if (fs.existsSync(aiDir)) {
        const files = this.getJsonFiles(aiDir);
        
        for (const file of files) {
          try {
            const content = fs.readFileSync(file, 'utf-8');
            const data = JSON.parse(content);
            
            const article: SeedArticle = {
              filename: path.basename(file),
              slug: data.slug || '',
              title: data.title || '',
              category: data.category || '',
              language: data.language || 'en',
              keywords: data.keywords || [],
              summary: data.summary || '',
              content: data.content || '',
              questions: data.questions,
              approved: data.approved || false,
              version: data.version || 1,
              lastReviewed: data.lastReviewed || '',
              reviewedBy: data.reviewedBy || '',
              tags: data.tags || [],
            };

            articles.push(article);
          } catch (error) {
            console.error(`[SeedReaderService] Error reading file ${file}:`, error);
          }
        }
      }

      // Also check for seed files in subdirectories
      const subDirs = fs.readdirSync(this.seedDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== 'ai');
      
      for (const subDir of subDirs) {
        const subDirPath = path.join(this.seedDir, subDir.name);
        const files = this.getJsonFiles(subDirPath);
        
        for (const file of files) {
          try {
            const content = fs.readFileSync(file, 'utf-8');
            const data = JSON.parse(content);
            
            const article: SeedArticle = {
              filename: path.basename(file),
              slug: data.slug || '',
              title: data.title || '',
              category: data.category || subDir.name,
              language: data.language || 'en',
              keywords: data.keywords || [],
              summary: data.summary || '',
              content: data.content || '',
              questions: data.questions,
              approved: data.approved || false,
              version: data.version || 1,
              lastReviewed: data.lastReviewed || '',
              reviewedBy: data.reviewedBy || '',
              tags: data.tags || [],
            };

            articles.push(article);
          } catch (error) {
            console.error(`[SeedReaderService] Error reading file ${file}:`, error);
          }
        }
      }

    } catch (error) {
      console.error('[SeedReaderService] Error reading seed files:', error);
    }

    return articles;
  }

  private getJsonFiles(dir: string): string[] {
    const files: string[] = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isFile() && entry.name.endsWith('.json')) {
          files.push(fullPath);
        } else if (entry.isDirectory()) {
          // Recursively search subdirectories
          files.push(...this.getJsonFiles(fullPath));
        }
      }
    } catch (error) {
      console.error(`[SeedReaderService] Error reading directory ${dir}:`, error);
    }
    
    return files;
  }

  getArticlesByCategory(articles: SeedArticle[], category: string): SeedArticle[] {
    return articles.filter(a => a.category === category);
  }

  getArticlesByKeyword(articles: SeedArticle[], keyword: string): SeedArticle[] {
    const lowerKeyword = keyword.toLowerCase();
    return articles.filter(a => 
      a.keywords.some(k => k.toLowerCase().includes(lowerKeyword)) ||
      a.title.toLowerCase().includes(lowerKeyword) ||
      a.content.toLowerCase().includes(lowerKeyword)
    );
  }
}
