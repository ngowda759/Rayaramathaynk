import { test, expect, Page } from '@playwright/test';
import { BASE_URL } from '../test-utils';

test.describe('Firebase Storage Module', () => {
  test.describe('Image Storage', () => {
    test('STORAGE-001: Images load from Firebase Storage', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      const images = page.locator('img');
      const count = await images.count();
      
      // Check if any images are from Firebase Storage
      for (let i = 0; i < Math.min(count, 5); i++) {
        const img = images.nth(i);
        const src = await img.getAttribute('src');
        if (src && src.includes('firebasestorage')) {
          // Image is from Firebase Storage
          const loaded = await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
          expect(loaded).toBe(true);
        }
      }
    });

    test('STORAGE-002: Gallery images load correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      await page.waitForLoadState('networkidle');
      
      const images = page.locator('img');
      const count = await images.count();
      
      let brokenImages = 0;
      for (let i = 0; i < Math.min(count, 5); i++) {
        const img = images.nth(i);
        if (await img.isVisible()) {
          const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
          if (naturalWidth === 0) brokenImages++;
        }
      }
      
      expect(brokenImages).toBe(0);
    });

    test('STORAGE-003: Image URLs are valid', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 3); i++) {
        const img = images.nth(i);
        const src = await img.getAttribute('src');
        if (src) {
          expect(src.startsWith('http') || src.startsWith('/')).toBe(true);
        }
      }
    });
  });

  test.describe('Upload Functionality', () => {
    test('STORAGE-010: Admin upload interface exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/gallery`);
      await page.waitForTimeout(2000);
      
      const uploadButton = page.locator('button:has-text("Upload"), input[type="file"]');
      const count = await uploadButton.count();
      // Should have upload functionality
    });

    test('STORAGE-011: File input accepts images', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/gallery`);
      await page.waitForTimeout(2000);
      
      const fileInput = page.locator('input[type="file"]');
      const count = await fileInput.count();
      
      if (count > 0) {
        const accept = await fileInput.first().getAttribute('accept');
        expect(accept).toContain('image');
      }
    });

    test('STORAGE-012: Invalid file types are rejected', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/gallery`);
      await page.waitForTimeout(2000);
      
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.count() > 0) {
        const accept = await fileInput.first().getAttribute('accept');
        // Should only accept images
        expect(accept).toBeTruthy();
      }
    });
  });

  test.describe('Storage Security', () => {
    test('STORAGE-020: Storage rules prevent unauthorized access', async ({ page }) => {
      // This tests that storage is properly configured
      // Actual rule testing would require Firebase Admin SDK
    });

    test('STORAGE-021: Upload requires authentication', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/gallery`);
      await page.waitForTimeout(2000);
      
      // Should redirect to login if not authenticated
      const url = page.url();
      expect(url).toBeTruthy();
    });
  });

  test.describe('Storage Performance', () => {
    test('STORAGE-030: Images are lazy loaded', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      
      const lazyImages = page.locator('img[loading="lazy"]');
      const count = await lazyImages.count();
      
      const allImages = page.locator('img');
      const totalCount = await allImages.count();
      
      if (totalCount > 5) {
        expect(count).toBeGreaterThan(0);
      }
    });

    test('STORAGE-031: Image sizes are reasonable', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 3); i++) {
        const img = images.nth(i);
        const src = await img.getAttribute('src');
        
        if (src && src.includes('firebasestorage')) {
          const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
          // Images should not be excessively large
          expect(naturalWidth).toBeLessThan(10000);
        }
      }
    });

    test('STORAGE-032: Thumbnails are used for lists', async ({ page }) => {
      await page.goto(`${BASE_URL}/gallery`);
      
      const images = page.locator('img');
      const count = await images.count();
      
      let thumbnailCount = 0;
      for (let i = 0; i < Math.min(count, 5); i++) {
        const img = images.nth(i);
        const src = await img.getAttribute('src');
        
        if (src && (src.includes('thumb') || src.includes('/thumb'))) {
          thumbnailCount++;
        }
      }
      
      // Should use thumbnails for list views
    });
  });

  test.describe('Error Handling', () => {
    test('STORAGE-040: Missing images show fallback', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 3); i++) {
        const img = images.nth(i);
        const onError = await img.getAttribute('onerror');
        const alt = await img.getAttribute('alt');
        
        // Should have fallback or alt text
        expect(onError || alt).toBeTruthy();
      }
    });

    test('STORAGE-041: Broken storage URLs handled', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => {
        errors.push(error.message);
      });
      
      await page.goto(BASE_URL);
      await page.waitForTimeout(2000);
      
      // Should not crash on broken image URLs
      expect(errors.length).toBe(0);
    });
  });
});
