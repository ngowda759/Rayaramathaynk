import {
  ContentQualityIssue,
  PageInfo,
} from '@/types/proof-report';

export class ContentQualityService {
  async checkPages(pages: PageInfo[]): Promise<ContentQualityIssue[]> {
    const issues: ContentQualityIssue[] = [];

    for (const page of pages) {
      // Check for empty pages
      if (!page.visibleText || page.visibleText.trim().length < 50) {
        issues.push({
          type: 'empty-page',
          pageUrl: page.url,
          severity: 'error',
          message: 'Page appears to be empty or has very minimal content',
        });
      }

      // Check for short pages
      if (page.visibleText && page.visibleText.length < 200 && page.visibleText.trim().length >= 50) {
        issues.push({
          type: 'short-page',
          pageUrl: page.url,
          severity: 'warning',
          message: `Page has minimal content (${page.visibleText.length} characters)`,
        });
      }

      // Check for placeholder text
      const placeholderPatterns = [
        /lorem ipsum/i,
        /lorem\d+/i,
        /todo/i,
        /fixme/i,
        /placeholder/i,
        /tbd/i,
        /coming soon/i,
      ];

      for (const pattern of placeholderPatterns) {
        if (pattern.test(page.visibleText)) {
          issues.push({
            type: 'placeholder-text',
            pageUrl: page.url,
            severity: 'error',
            message: `Placeholder text detected: ${pattern.source}`,
          });
          break;
        }
      }

      // Check for duplicate paragraphs across pages
      const paragraphs = page.visibleText.split(/\n\n+/).filter(p => p.length > 100);
      
      // Simple duplicate detection within the same page
      const paragraphCounts: Record<string, number> = {};
      for (const para of paragraphs) {
        const normalized = para.trim().toLowerCase().substring(0, 100);
        paragraphCounts[normalized] = (paragraphCounts[normalized] || 0) + 1;
      }

      for (const [para, count] of Object.entries(paragraphCounts)) {
        if (count > 2) {
          issues.push({
            type: 'duplicate-paragraph',
            pageUrl: page.url,
            severity: 'warning',
            message: `Duplicate paragraph content detected (${count} times)`,
            content: para,
          });
        }
      }
    }

    // Check for repeated content across pages
    const pageContents = pages.map(p => ({
      url: p.url,
      text: p.visibleText.substring(0, 500).trim().toLowerCase(),
    }));

    for (let i = 0; i < pageContents.length; i++) {
      for (let j = i + 1; j < pageContents.length; j++) {
        const similarity = this.calculateSimilarity(pageContents[i].text, pageContents[j].text);
        
        if (similarity > 0.8) {
          issues.push({
            type: 'repeated-content',
            pageUrl: pageContents[i].url,
            severity: 'warning',
            message: `High similarity to ${pageContents[j].url} (${Math.round(similarity * 100)}%)`,
          });
        }
      }
    }

    return issues;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));

    if (words1.size === 0 || words2.size === 0) return 0;

    let intersection = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        intersection++;
      }
    }

    const union = words1.size + words2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
}
