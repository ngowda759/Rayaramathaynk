import { chromium, Browser, Page } from 'playwright';
import {
  PageInfo,
  ImageInfo,
  FormInfo,
  FormField,
  ContactInfo,
} from '@/types/proof-report';

export class CrawlerService {
  private browser: Browser | null = null;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async crawlPage(pageUrl: string): Promise<PageInfo> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const context = await this.browser.newContext();
    const page = await context.newPage();
    
    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
      
      const pageInfo: PageInfo = {
        url: pageUrl,
        title: await this.getPageTitle(page),
        heading: await this.getMainHeading(page),
        metaTitle: await this.getMetaTitle(page),
        metaDescription: await this.getMetaDescription(page),
        visibleText: await this.getVisibleText(page),
        images: await this.getImages(page),
        externalLinks: await this.getExternalLinks(page, pageUrl),
        internalLinks: await this.getInternalLinks(page, pageUrl),
        tables: await this.getTables(page),
        lists: await this.getLists(page),
        buttons: await this.getButtons(page),
        forms: await this.getForms(page),
        contactInfo: await this.getContactInfo(page),
      };

      return pageInfo;
    } finally {
      await context.close();
    }
  }

  async discoverPublicRoutes(): Promise<string[]> {
    const routes: string[] = [];
    
    // Public routes discovered from the app directory structure
    const publicRoutes = [
      '',
      '/aaradhane',
      '/about',
      '/donation',
      '/events',
      '/facilities',
      '/future-plans',
      '/gallery',
      '/guruparampara',
      '/pooja',
      '/sevas',
      '/shlokas',
      '/testimonials',
      '/trust',
      '/calendar',
      '/calendar/ekadashi',
      '/calendar/festivals',
    ];

    for (const route of publicRoutes) {
      const url = `${this.baseUrl}${route}`;
      routes.push(url);
    }

    return routes;
  }

  private async getPageTitle(page: Page): Promise<string> {
    return page.title();
  }

  private async getMainHeading(page: Page): Promise<string> {
    try {
      return await page.locator('h1').first().textContent() || '';
    } catch {
      return '';
    }
  }

  private async getMetaTitle(page: Page): Promise<string> {
    try {
      return await page.locator('meta[property="og:title"]').getAttribute('content') || 
             await page.locator('title').textContent() || '';
    } catch {
      return '';
    }
  }

  private async getMetaDescription(page: Page): Promise<string> {
    try {
      return await page.locator('meta[name="description"]').getAttribute('content') || '';
    } catch {
      return '';
    }
  }

  private async getVisibleText(page: Page): Promise<string> {
    try {
      return await page.locator('body').textContent() || '';
    } catch {
      return '';
    }
  }

  private async getImages(page: Page): Promise<ImageInfo[]> {
    const images: ImageInfo[] = [];
    
    try {
      const imgElements = await page.locator('img').all();
      
      for (const img of imgElements) {
        const src = await img.getAttribute('src') || '';
        const alt = await img.getAttribute('alt') || '';
        const width = await img.getAttribute('width');
        const height = await img.getAttribute('height');
        
        images.push({
          src,
          alt,
          width: width ? parseInt(width) : undefined,
          height: height ? parseInt(height) : undefined,
          isDecorative: alt === '' || alt === undefined,
        });
      }
    } catch {
      // Ignore errors
    }
    
    return images;
  }

  private async getExternalLinks(page: Page, currentUrl: string): Promise<string[]> {
    const externalLinks: string[] = [];
    const baseDomain = new URL(currentUrl).hostname;
    
    try {
      const links = await page.locator('a[href]').all();
      
      for (const link of links) {
        const href = await link.getAttribute('href') || '';
        
        if (href.startsWith('http')) {
          try {
            const linkDomain = new URL(href).hostname;
            if (linkDomain !== baseDomain) {
              externalLinks.push(href);
            }
          } catch {
            // Invalid URL, skip
          }
        }
      }
    } catch {
      // Ignore errors
    }
    
    return [...new Set(externalLinks)];
  }

  private async getInternalLinks(page: Page, currentUrl: string): Promise<string[]> {
    const internalLinks: string[] = [];
    const baseUrlObj = new URL(currentUrl);
    
    try {
      const links = await page.locator('a[href]').all();
      
      for (const link of links) {
        const href = await link.getAttribute('href') || '';
        
        if (href.startsWith('/')) {
          internalLinks.push(`${baseUrlObj.origin}${href}`);
        } else if (href.startsWith('#')) {
          internalLinks.push(`${currentUrl}${href}`);
        }
      }
    } catch {
      // Ignore errors
    }
    
    return [...new Set(internalLinks)];
  }

  private async getTables(page: Page): Promise<string[]> {
    const tables: string[] = [];
    
    try {
      const tableElements = await page.locator('table').all();
      
      for (const table of tableElements) {
        const text = await table.textContent();
        if (text) {
          tables.push(text.trim().substring(0, 500));
        }
      }
    } catch {
      // Ignore errors
    }
    
    return tables;
  }

  private async getLists(page: Page): Promise<string[]> {
    const lists: string[] = [];
    
    try {
      const listElements = await page.locator('ul, ol').all();
      
      for (const list of listElements) {
        const items = await list.locator('li').allTextContents();
        if (items.length > 0) {
          lists.push(items.join(', '));
        }
      }
    } catch {
      // Ignore errors
    }
    
    return lists;
  }

  private async getButtons(page: Page): Promise<string[]> {
    const buttons: string[] = [];
    
    try {
      const buttonElements = await page.locator('button').all();
      
      for (const button of buttonElements) {
        const text = await button.textContent() || '';
        const id = await button.getAttribute('id') || '';
        const ariaLabel = await button.getAttribute('aria-label') || '';
        
        buttons.push(text.trim() || id || ariaLabel);
      }
    } catch {
      // Ignore errors
    }
    
    return [...new Set(buttons.filter(b => b))];
  }

  private async getForms(page: Page): Promise<FormInfo[]> {
    const forms: FormInfo[] = [];
    
    try {
      const formElements = await page.locator('form').all();
      
      for (const form of formElements) {
        const id = await form.getAttribute('id') || undefined;
        const name = await form.getAttribute('name') || undefined;
        const action = await form.getAttribute('action') || undefined;
        const method = await form.getAttribute('method') || undefined;
        
        const fields: FormField[] = [];
        const inputElements = await form.locator('input, textarea, select').all();
        
        for (const input of inputElements) {
          const fieldName = await input.getAttribute('name') || '';
          const fieldType = await input.getAttribute('type') || 'text';
          const label = await input.getAttribute('aria-label') || 
                       await page.locator(`label[for="${await input.getAttribute('id')}"]`).textContent() || '';
          const required = await input.getAttribute('required') !== null;
          
          fields.push({
            name: fieldName,
            type: fieldType,
            label: label || undefined,
            required,
          });
        }
        
        forms.push({
          id,
          name,
          action,
          method,
          fields,
        });
      }
    } catch {
      // Ignore errors
    }
    
    return forms;
  }

  private async getContactInfo(page: Page): Promise<ContactInfo> {
    const contactInfo: ContactInfo = {
      phones: [],
      emails: [],
      addresses: [],
    };
    
    try {
      const pageText = await page.locator('body').textContent() || '';
      
      // Extract phone numbers
      const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
      const phones = pageText.match(phoneRegex);
      if (phones) {
        contactInfo.phones = [...new Set(phones.filter(p => p.length >= 10))];
      }
      
      // Extract emails
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails = pageText.match(emailRegex);
      if (emails) {
        contactInfo.emails = [...new Set(emails)];
      }
      
      // Extract addresses (simplified)
      const addressRegex = /(?:address|located at|located in)[^.]*[,.]/gi;
      const addresses = pageText.match(addressRegex);
      if (addresses) {
        contactInfo.addresses = addresses.map(a => a.trim());
      }
    } catch {
      // Ignore errors
    }
    
    return contactInfo;
  }
}
