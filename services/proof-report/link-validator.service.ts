import {
  LinkValidationResult,
  PageInfo,
} from '@/types/proof-report';

export class LinkValidatorService {
  private timeout = 10000; // 10 second timeout for link checks

  async validateLinks(pages: PageInfo[]): Promise<LinkValidationResult[]> {
    const results: LinkValidationResult[] = [];
    const seenUrls = new Set<string>();

    for (const page of pages) {
      // Validate internal links
      for (const link of page.internalLinks) {
        if (seenUrls.has(link)) continue;
        seenUrls.add(link);

        try {
          const result = await this.checkLink(link, page.url);
          results.push(result);
        } catch (error) {
          results.push({
            url: link,
            pageUrl: page.url,
            status: 'broken',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Validate external links (just check they resolve, not that content is reachable)
      for (const link of page.externalLinks) {
        if (seenUrls.has(link)) continue;
        seenUrls.add(link);

        try {
          const result = await this.checkLink(link, page.url);
          results.push(result);
        } catch (error) {
          results.push({
            url: link,
            pageUrl: page.url,
            status: 'broken',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return results;
  }

  private async checkLink(url: string, pageUrl: string): Promise<LinkValidationResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return {
          url,
          pageUrl,
          status: 'valid',
          statusCode: response.status,
        };
      }

      if (response.redirected) {
        return {
          url,
          pageUrl,
          status: 'redirect',
          statusCode: response.status,
          redirectUrl: response.url,
        };
      }

      return {
        url,
        pageUrl,
        status: response.status === 404 ? 'broken' : 'broken',
        statusCode: response.status,
        error: `HTTP ${response.status}`,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            url,
            pageUrl,
            status: 'broken',
            error: 'Request timeout',
          };
        }
        return {
          url,
          pageUrl,
          status: 'broken',
          error: error.message,
        };
      }

      return {
        url,
        pageUrl,
        status: 'broken',
        error: 'Unknown error',
      };
    }
  }

  getBrokenLinks(results: LinkValidationResult[]): LinkValidationResult[] {
    return results.filter(r => r.status === 'broken');
  }

  getRedirects(results: LinkValidationResult[]): LinkValidationResult[] {
    return results.filter(r => r.status === 'redirect');
  }

  getExternalLinks(results: LinkValidationResult[]): LinkValidationResult[] {
    return results.filter(r => r.status === 'external');
  }
}
