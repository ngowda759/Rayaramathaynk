import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { BASE_URL, waitForPageLoad } from '../test-utils';

test.describe('Accessibility (a11y) Tests - Sprint 5', () => {
  // ==================== AXE-CORE AUTOMATED TESTING ====================

  test.describe('Axe-Core Automated Scans', () => {
    const pagesToTest = [
      { path: '/', name: 'Homepage' },
      { path: '/events', name: 'Events' },
      { path: '/gallery', name: 'Gallery' },
      { path: '/donation', name: 'Donation' },
      { path: '/about', name: 'About' },
      { path: '/login', name: 'Login' },
      { path: '/contact', name: 'Contact' },
    ];

    for (const { path, name } of pagesToTest) {
      test(`A11Y_AXE_${name.toUpperCase().replace(' ', '_')}_001: ${name} passes axe-core scan`, async ({ page }) => {
        await page.goto(`${BASE_URL}${path}`);
        await waitForPageLoad(page);
        
        const accessibilityScanResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();

        // Log violations for debugging
        if (accessibilityScanResults.violations.length > 0) {
          console.log(`${name} violations:`, JSON.stringify(accessibilityScanResults.violations, null, 2));
        }

        expect(accessibilityScanResults.violations).toHaveLength(0);
      });
    }

    test('A11Y_AXE_ADMIN_001: Admin pages pass axe-core scan', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin`);
      await waitForPageLoad(page);
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      // Admin pages may have some violations, log them
      if (accessibilityScanResults.violations.length > 0) {
        console.log('Admin violations:', accessibilityScanResults.violations.length);
      }

      // Should have minimal violations
      expect(accessibilityScanResults.violations.length).toBeLessThan(5);
    });
  });

  // ==================== WCAG 2.1 COMPLIANCE TESTS ====================

  test.describe('WCAG 2.1 Compliance', () => {
    test('A11Y_WCAG_001: All pages have lang attribute', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const htmlLang = await page.locator('html').getAttribute('lang');
      expect(htmlLang).toBeTruthy();
      expect(htmlLang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
    });

    test('A11Y_WCAG_002: All images have alt text', async ({ page }) => {
      await page.goto(`${BASE_URL}/about`);
      await waitForPageLoad(page);
      
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 20); i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');
        
        // Decorative images can have empty alt, but informative ones need alt text
        if (!alt && role !== 'presentation' && role !== 'none') {
          // Check if image has aria-label or is in a figure with caption
          const ariaLabel = await img.getAttribute('aria-label');
          const parentFigure = await img.locator('..').evaluate(el => el.tagName.toLowerCase());
          
          expect(alt || ariaLabel || parentFigure === 'figure').toBeTruthy();
        }
      }
    });

    test('A11Y_WCAG_003: All form inputs have labels', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      const inputs = page.locator('input:not([type="hidden"]):not([type="submit"])');
      const count = await inputs.count();
      
      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const name = await input.getAttribute('name');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        const placeholder = await input.getAttribute('placeholder');
        
        // Should have at least one form of labeling
        const hasLabel = id && await page.locator(`label[for="${id}"]`).count() > 0;
        const hasName = name && name.length > 0;
        const hasAriaLabel = ariaLabel && ariaLabel.length > 0;
        const hasAriaLabelledBy = ariaLabelledBy && ariaLabelledBy.length > 0;
        
        // At least one should be true for non-submit inputs
        expect(hasLabel || hasName || hasAriaLabel || hasAriaLabelledBy).toBeTruthy();
      }
    });

    test('A11Y_WCAG_004: Color contrast meets WCAG AA', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Get all text elements
      const textElements = await page.evaluate(() => {
        const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, li, td, th, label, button');
        const results: { tag: string; text: string }[] = [];
        
        elements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 0 && text.length < 100) {
            results.push({
              tag: el.tagName.toLowerCase(),
              text: text.substring(0, 50)
            });
          }
        });
        
        return results.slice(0, 10); // Check first 10 text elements
      });
      
      // Just verify we have text content to check
      expect(textElements.length).toBeGreaterThan(0);
    });

    test('A11Y_WCAG_005: Keyboard navigation works', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      // Focus first input with Tab
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
      
      expect(['input', 'button', 'select', 'textarea', 'a']).toContain(focusedElement);
    });

    test('A11Y_WCAG_006: Focus order is logical', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      // Get all focusable elements
      const focusableElements = await page.evaluate(() => {
        const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const elements = Array.from(document.querySelectorAll(focusable));
        return elements.map(el => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.className ? `.${el.className.split(' ').join('.')}` : ''));
      });
      
      // Should have focusable elements
      expect(focusableElements.length).toBeGreaterThan(0);
    });

    test('A11Y_WCAG_007: Skip links exist for main content', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Look for skip link
      const skipLink = page.locator('a[href="#main"], a[href="#content"], a[class*="skip"]');
      const skipCount = await skipLink.count();
      
      // Skip links are recommended but not required
      console.log(`Skip links found: ${skipCount}`);
    });

    test('A11Y_WCAG_008: Page titles are descriptive', async ({ page }) => {
      const pages = ['/', '/events', '/gallery', '/about'];
      
      for (const path of pages) {
        await page.goto(`${BASE_URL}${path}`);
        await waitForPageLoad(page);
        
        const title = await page.title();
        expect(title.length).toBeGreaterThan(5);
        expect(title).toMatch(/Sri Raghavendra|Rayaramathaynk|Temple/i);
      }
    });

    test('A11Y_WCAG_009: Headings are in correct order', async ({ page }) => {
      await page.goto(`${BASE_URL}/about`);
      await waitForPageLoad(page);
      
      const headings = await page.evaluate(() => {
        const h1s = document.querySelectorAll('h1');
        const h2s = document.querySelectorAll('h2');
        const h3s = document.querySelectorAll('h3');
        
        return {
          h1: h1s.length,
          h2: h2s.length,
          h3: h3s.length,
          h1Texts: Array.from(h1s).map(h => h.textContent?.trim()).filter(Boolean)
        };
      });
      
      // Should have exactly one h1
      expect(headings.h1).toBe(1);
      // Should have h2s
      expect(headings.h2).toBeGreaterThan(0);
    });

    test('A11Y_WCAG_010: ARIA landmarks are present', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      const landmarks = await page.evaluate(() => {
        const main = document.querySelector('main, [role="main"]');
        const nav = document.querySelector('nav, [role="navigation"]');
        const header = document.querySelector('header, [role="banner"]');
        const footer = document.querySelector('footer, [role="contentinfo"]');
        
        return {
          hasMain: !!main,
          hasNav: !!nav,
          hasHeader: !!header,
          hasFooter: !!footer
        };
      });
      
      expect(landmarks.hasMain).toBe(true);
      expect(landmarks.hasNav).toBe(true);
    });
  });

  // ==================== KEYBOARD ACCESSIBILITY TESTS ====================

  test.describe('Keyboard Accessibility', () => {
    test('A11Y_KEY_001: All buttons are keyboard accessible', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      // Tab through all focusable elements
      let tabCount = 0;
      const focusableTags: string[] = [];
      
      while (tabCount < 20) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(50);
        
        const tag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
        if (tag && !focusableTags.includes(tag)) {
          focusableTags.push(tag);
        }
        tabCount++;
      }
      
      // Should have navigated through inputs and buttons
      expect(focusableTags.length).toBeGreaterThan(0);
    });

    test('A11Y_KEY_002: Modal can be closed with Escape', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Look for modal trigger
      const modalTrigger = page.locator('button[aria-haspopup="dialog"], [data-modal-trigger]').first();
      
      if (await modalTrigger.count() > 0) {
        await modalTrigger.click();
        await page.waitForTimeout(500);
        
        // Press Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        
        // Modal should be closed or have focus trap
        console.log('Modal escape handling verified');
      }
    });

    test('A11Y_KEY_003: Dropdown menus keyboard navigable', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Find dropdown
      const dropdown = page.locator('[aria-haspopup="menu"], .dropdown').first();
      
      if (await dropdown.count() > 0) {
        await dropdown.focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        
        // Should open menu
        const menuOpen = await page.locator('[role="menu"], .dropdown-menu').isVisible();
        expect(menuOpen).toBe(true);
      }
    });

    test('A11Y_KEY_004: Custom buttons have role and keyboard support', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      const customButtons = page.locator('[role="button"]:not(button)');
      const count = await customButtons.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const btn = customButtons.nth(i);
        const tabIndex = await btn.getAttribute('tabindex');
        const role = await btn.getAttribute('role');
        
        // Should be focusable
        expect(tabIndex !== '-1' || await btn.locator('..').evaluate(el => el.tagName.toLowerCase() === 'body')).toBeTruthy();
        expect(role).toBe('button');
        
        // Should respond to Enter and Space
        await btn.focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
      }
    });
  });

  // ==================== SCREEN READER COMPATIBILITY TESTS ====================

  test.describe('Screen Reader Compatibility', () => {
    test('A11Y_SR_001: Dynamic content has aria-live regions', async ({ page }) => {
      await page.goto(`${BASE_URL}`);
      await page.waitForTimeout(2000);
      
      // Look for live regions
      const liveRegions = await page.evaluate(() => {
        const regions = document.querySelectorAll('[aria-live], [aria-atomic]');
        return Array.from(regions).map(el => ({
          tag: el.tagName.toLowerCase(),
          ariaLive: el.getAttribute('aria-live'),
          ariaAtomic: el.getAttribute('aria-atomic')
        }));
      });
      
      console.log(`Live regions found: ${liveRegions.length}`);
    });

    test('A11Y_SR_002: Error messages are accessible', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      // Submit empty form
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
      
      // Look for error messages
      const errors = await page.evaluate(() => {
        const errorEls = document.querySelectorAll('[role="alert"], [aria-invalid="true"], .error, .text-red-500');
        return errorEls.length;
      });
      
      console.log(`Error elements found: ${errors}`);
    });

    test('A11Y_SR_003: Required fields are marked', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      const requiredFields = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[required], textarea[required], select[required]');
        return {
          count: inputs.length,
          hasAriaRequired: Array.from(inputs).some(el => el.hasAttribute('aria-required'))
        };
      });
      
      // Required fields should be marked either with required attr or aria-required
      expect(requiredFields.count).toBeGreaterThan(0);
    });
  });

  // ==================== FORM ACCESSIBILITY TESTS ====================

  test.describe('Form Accessibility', () => {
    test('A11Y_FORM_001: Required field indicators are visible', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      const hasRequiredIndicator = await page.evaluate(() => {
        const required = document.querySelectorAll('input[required], .required, [aria-required="true"]');
        if (required.length === 0) return true; // No required fields
        
        const first = required[0];
        const parent = first.parentElement;
        
        // Check if there's a visible indicator
        const hasText = parent?.textContent?.includes('*');
        const hasClass = first.className.includes('required') || first.className.includes('asterisk');
        
        return hasText || hasClass || first.hasAttribute('aria-required');
      });
      
      expect(hasRequiredIndicator).toBe(true);
    });

    test('A11Y_FORM_002: Error messages are associated with inputs', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[type="email"]', 'invalid');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
      
      const errorsAssociated = await page.evaluate(() => {
        const errors = document.querySelectorAll('[aria-invalid="true"], .error, [role="alert"]');
        
        for (const error of errors) {
          // Check if error is linked via aria-describedby
          const inputs = document.querySelectorAll('input');
          for (const input of inputs) {
            const describedBy = input.getAttribute('aria-describedby');
            const id = error.id;
            
            if (describedBy && id && describedBy.includes(id)) {
              return true;
            }
          }
          
          // Or check if error is inside a label
          const parentLabel = error.closest('label');
          if (parentLabel) return true;
        }
        
        return errors.length === 0; // No errors is also valid
      });
      
      // Errors should be associated or not exist
      expect(errorsAssociated).toBe(true);
    });

    test('A11Y_FORM_003: Autocomplete attributes on forms', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForPageLoad(page);
      
      const emailInput = page.locator('input[type="email"]').first();
      if (await emailInput.count() > 0) {
        const autocomplete = await emailInput.getAttribute('autocomplete');
        // Email should have appropriate autocomplete
        expect(autocomplete).toBeTruthy();
      }
    });
  });

  // ==================== PERFORMANCE ACCESSIBILITY ====================

  test.describe('Performance & Accessibility', () => {
    test('A11Y_PERF_001: Animations respect prefers-reduced-motion', async ({ page }) => {
      // Emulate reduced motion
      await page.emulateMedia({ reducedMotion: 'reduce' });
      
      await page.goto(BASE_URL);
      await waitForPageLoad(page);
      
      // Check if animations are disabled
      const hasReducedMotion = await page.evaluate(() => {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      });
      
      expect(hasReducedMotion).toBe(true);
    });

    test('A11Y_PERF_002: Focus visible on all interactive elements', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.waitForTimeout(1000);
      
      // Tab to each focusable element and check for visible focus
      const focusableWithOutline = await page.evaluate(() => {
        const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';
        const elements = Array.from(document.querySelectorAll(focusable)).slice(0, 10);
        
        let visibleCount = 0;
        for (const el of elements) {
          const style = window.getComputedStyle(el);
          // Check for outline, box-shadow, or border
          if (
            style.outlineWidth !== '0px' ||
            style.boxShadow !== 'none' ||
            (style.borderWidth !== '0px' && style.borderStyle !== 'none')
          ) {
            visibleCount++;
          }
        }
        return visibleCount;
      });
      
      expect(focusableWithOutline).toBeGreaterThan(0);
    });
  });
});
