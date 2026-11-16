// utilities/crawler.ts
import { Page, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { SafetyGuard } from './safetyGuard';
import { ReportCollector } from './reporter';

export interface CrawlOptions {
  maxDepth?: number;
  maxActionsPerPage?: number;
  maxPages?: number;
  timeoutMs?: number;
}

export class Crawler {
  private visited = new Set<string>();
  private queue: { url: string; depth: number }[] = [];
  private report: ReportCollector;
  private guard: SafetyGuard;

  constructor(private page: Page, private options: CrawlOptions = {}) {
    this.report = new ReportCollector();
    this.guard = new SafetyGuard();
    this.queue.push({ url: this.page.url(), depth: 0 });
  }

  async run() {
    const { maxDepth = 3, maxPages = 100 } = this.options;
    while (this.queue.length && this.visited.size < maxPages) {
      const { url, depth } = this.queue.shift()!;
      if (this.visited.has(url) || depth > maxDepth) continue;
      await this.visit(url, depth);
    }
    await this.report.finalize();
  }

  private async visit(url: string, depth: number) {
    this.visited.add(url);
    await this.page.goto(url, { waitUntil: 'networkidle' });
    await this.capturePageInfo(url);
    await this.interactPage(url, depth);
  }

  private async capturePageInfo(url: string) {
    // Capture console errors
    const consoleErrors: string[] = [];
    this.page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    // Capture network failures
    const failedRequests: { method: string; url: string; status: number }[] = [];
    this.page.on('requestfailed', request => {
      const response = request.response();
      failedRequests.push({
        method: request.method(),
        url: request.url(),
        status: response?.status() ?? 0,
      });
    });
    // Axe accessibility scan
    const axe = new AxeBuilder({ page: this.page });
    const accessibility = await axe.analyze();
    // Record findings
    this.report.addPageReport({
      url,
      consoleErrors,
      failedRequests,
      accessibility,
    });
  }

  private async interactPage(url: string, depth: number) {
    const { maxActionsPerPage = 10 } = this.options;
    const interactiveSelectors = await this.page.$$('[role="button"], button, a, select, input, textarea, [role="dialog"]');
    const actions = interactiveSelectors.slice(0, maxActionsPerPage);
    for (const elementHandle of actions) {
      const tag = await elementHandle.evaluate(el => el.tagName.toLowerCase());
      try {
        if (tag === 'a') {
          const href = await elementHandle.getAttribute('href');
          if (href && !this.visited.has(href) && href.startsWith(this.page.url())) {
            this.queue.push({ url: new URL(href, this.page.url()).toString(), depth: depth + 1 });
          }
        } else if (tag === 'button' || tag === 'select') {
          await elementHandle.click({ force: true, timeout: 2000 });
        } else if (tag === 'input' || tag === 'textarea') {
          const type = await elementHandle.getAttribute('type');
          if (type !== 'hidden' && type !== 'submit') {
            await elementHandle.fill('test');
          }
        }
        // Additional safe interactions can be added here
      } catch (e) {
        // Record interaction failure but continue
        this.report.addInteractionError({ url, selector: await elementHandle.evaluate(el => el.outerHTML), error: (e as Error).message });
      }
    }
  }
}
