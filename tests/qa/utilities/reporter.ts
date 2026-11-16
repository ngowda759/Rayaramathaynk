// utilities/reporter.ts
import fs from 'fs';
import path from 'path';

export interface PageReport {
  url: string;
  consoleErrors: string[];
  failedRequests: { method: string; url: string; status: number }[];
  accessibility: any; // axe results
}

export interface InteractionError {
  url: string;
  selector: string;
  error: string;
}

export class ReportCollector {
  private pages: PageReport[] = [];
  private interactions: InteractionError[] = [];

  addPageReport(report: PageReport) {
    this.pages.push(report);
  }

  addInteractionError(err: InteractionError) {
    this.interactions.push(err);
  }

  async finalize() {
    const outDir = path.resolve('test-results', 'qa');
    await fs.promises.mkdir(outDir, { recursive: true });
    const jsonPath = path.join(outDir, 'report.json');
    await fs.promises.writeFile(jsonPath, JSON.stringify({ pages: this.pages, interactions: this.interactions }, null, 2));
    // Generate simple markdown summary
    const mdLines: string[] = [];
    mdLines.push('# QA Automation Report');
    mdLines.push('');
    mdLines.push(`Total pages visited: ${this.pages.length}`);
    mdLines.push('');
    mdLines.push('## Console Errors');
    this.pages.forEach(p => {
      if (p.consoleErrors.length) {
        mdLines.push(`- **${p.url}**`);
        p.consoleErrors.forEach(e => mdLines.push(`  - ${e}`));
      }
    });
    mdLines.push('');
    mdLines.push('## Failed Network Requests');
    this.pages.forEach(p => {
      p.failedRequests.forEach(r => {
        mdLines.push(`- ${r.method} ${r.url} → ${r.status} (page: ${p.url})`);
      });
    });
    mdLines.push('');
    mdLines.push('## Accessibility Violations');
    this.pages.forEach(p => {
      const violations = p.accessibility?.violations ?? [];
      if (violations.length) {
        mdLines.push(`- **${p.url}**`);
        violations.forEach((v: any) => {
          mdLines.push(`  - ${v.id}: ${v.description} (impact: ${v.impact})`);
        });
      }
    });
    const mdPath = path.join(outDir, 'QA_REPORT.md');
    await fs.promises.writeFile(mdPath, mdLines.join('\n'));
  }
}
