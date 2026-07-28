import { Page, Locator, expect } from '@playwright/test';

// Test configuration
export const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
export const ADMIN_URL = `${BASE_URL}/admin`;
export const API_URL = BASE_URL;

// Viewport configurations
export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
  largeDesktop: { width: 1920, height: 1080 },
};

// Helper functions
export async function waitForPageLoad(page: Page, timeout = 30000): Promise<void> {
  await page.waitForLoadState('domcontentloaded', { timeout });
  await page.waitForLoadState('networkidle', { timeout: timeout * 2 }).catch(() => {
    // Network idle might not be achievable, so we continue anyway
  });
}

export async function checkConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

export async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
}

export async function scrollToTop(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
}

export async function getAllLinks(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links.map(link => link.href).filter(href => href.startsWith('http'));
  });
}

export async function isLinkWorking(page: Page, url: string): Promise<boolean> {
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    return response?.status() === 200;
  } catch {
    return false;
  }
}

export async function fillFormFields(page: Page, fields: Record<string, string>): Promise<void> {
  for (const [selector, value] of Object.entries(fields)) {
    const input = page.locator(selector);
    if (await input.count() > 0) {
      await input.fill(value);
    }
  }
}

export async function submitForm(page: Page, submitSelector = 'button[type="submit"]'): Promise<void> {
  await page.click(submitSelector);
  await page.waitForTimeout(1000);
}

export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `reports/screenshots/${name}.png`, fullPage: true });
}

export async function getMetaContent(page: Page, name: string): Promise<string | null> {
  return await page.getAttribute(`meta[name="${name}"]`, 'content');
}

export async function getOgContent(page: Page, property: string): Promise<string | null> {
  return await page.getAttribute(`meta[property="${property}"]`, 'content');
}

// Accessibility helpers
export async function getHeadingHierarchy(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const headings: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const h = document.querySelectorAll(`h${i}`);
      headings.push(...Array.from(h).map(el => el.tagName));
    }
    return headings;
  });
}

export async function countImagesWithoutAlt(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const images = document.querySelectorAll('img');
    let count = 0;
    images.forEach(img => {
      if (!img.alt && img.src) {
        count++;
      }
    });
    return count;
  });
}

export async function getFocusableElements(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const elements = document.querySelectorAll(focusable);
    return Array.from(elements).map(el => el.tagName.toLowerCase());
  });
}

// Performance helpers
export async function measurePageLoadTime(page: Page, url: string): Promise<number> {
  const start = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return Date.now() - start;
}

export async function getCoreWebVitals(page: Page): Promise<Record<string, number>> {
  return await page.evaluate(() => {
    return new Promise(resolve => {
      const metrics: Record<string, number> = {};
      
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          metrics[entry.name] = entry.startTime;
        }
      }).observe({ type: 'paint', buffered: true });
      
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          const e = entry as PerformancePaintTiming;
          metrics['FCP'] = e.startTime;
        }
      }).observe({ type: 'paint', buffered: true });
      
      setTimeout(() => resolve(metrics), 3000);
    });
  });
}

// Firestore helpers
export async function getFirestoreDoc(page: Page, collection: string, docId: string): Promise<unknown> {
  return await page.evaluate(
    ({ collection, docId }) => {
      return new Promise((resolve) => {
        // This would need actual Firestore implementation
        resolve(null);
      });
    },
    { collection, docId }
  );
}

// Form validation helpers
export async function validateEmail(email: string): Promise<boolean> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function checkRequiredFields(page: Page, selector: string): Promise<string[]> {
  const fields = await page.locator(selector).all();
  const requiredFields: string[] = [];
  
  for (const field of fields) {
    const isRequired = await field.getAttribute('required');
    const name = await field.getAttribute('name') || await field.getAttribute('placeholder');
    if (isRequired !== null) {
      requiredFields.push(name || 'unnamed');
    }
  }
  
  return requiredFields;
}

// Navigation helpers
export async function getBreadcrumbs(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const breadcrumbs = document.querySelectorAll('[aria-label="Breadcrumb"] li, .breadcrumbs li, nav[aria-label="Breadcrumb"] a');
    return Array.from(breadcrumbs).map(el => el.textContent?.trim() || '');
  });
}

export async function navigateBack(page: Page): Promise<void> {
  await page.goBack();
  await waitForPageLoad(page);
}

export async function navigateForward(page: Page): Promise<void> {
  await page.goForward();
  await waitForPageLoad(page);
}

// Wait helpers
export async function waitForSelector(page: Page, selector: string, timeout = 10000): Promise<Locator | null> {
  try {
    await page.waitForSelector(selector, { timeout });
    return page.locator(selector);
  } catch {
    return null;
  }
}

export async function waitForDialog(page: Page): Promise<void> {
  page.on('dialog', async dialog => {
    await dialog.accept();
  });
}

// Screenshot directory creation
export async function ensureScreenshotDir(): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const dir = path.join(process.cwd(), 'reports', 'screenshots');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
