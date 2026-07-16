import {
  ImageValidationResult,
  PageInfo,
} from '@/types/proof-report';

export class ImageValidatorService {
  private timeout = 10000;

  async validateImages(pages: PageInfo[]): Promise<ImageValidationResult[]> {
    const results: ImageValidationResult[] = [];
    const seenUrls = new Set<string>();

    for (const page of pages) {
      for (const image of page.images) {
        if (!image.src || seenUrls.has(image.src)) continue;
        seenUrls.add(image.src);

        try {
          const result = await this.checkImage(image.src, page.url, image.alt);
          results.push(result);
        } catch (error) {
          results.push({
            src: image.src,
            pageUrl: page.url,
            status: 'broken',
            altText: image.alt,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return results;
  }

  private async checkImage(src: string, pageUrl: string, alt: string): Promise<ImageValidationResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(src, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          src,
          pageUrl,
          status: 'broken',
          altText: alt,
          error: `HTTP ${response.status}`,
        };
      }

      const contentLength = response.headers.get('content-length');
      const size = contentLength ? parseInt(contentLength) : 0;

      // Check if image is oversized (> 1MB)
      if (size > 1024 * 1024) {
        return {
          src,
          pageUrl,
          status: 'oversized',
          altText: alt,
          size,
        };
      }

      return {
        src,
        pageUrl,
        status: 'valid',
        altText: alt,
        size,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            src,
            pageUrl,
            status: 'broken',
            altText: alt,
            error: 'Request timeout',
          };
        }
        return {
          src,
          pageUrl,
          status: 'broken',
          altText: alt,
          error: error.message,
        };
      }

      return {
        src,
        pageUrl,
        status: 'broken',
        altText: alt,
        error: 'Unknown error',
      };
    }
  }

  getBrokenImages(results: ImageValidationResult[]): ImageValidationResult[] {
    return results.filter(r => r.status === 'broken');
  }

  getOversizedImages(results: ImageValidationResult[]): ImageValidationResult[] {
    return results.filter(r => r.status === 'oversized');
  }

  getImagesWithoutAlt(results: ImageValidationResult[]): ImageValidationResult[] {
    return results.filter(r => !r.altText);
  }
}
