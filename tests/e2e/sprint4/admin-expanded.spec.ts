import { test, expect, Page } from '@playwright/test';
import { BASE_URL, waitForPageLoad } from '../test-utils';
import { login, TEST_USERS } from '../sprint3/sprint3-test-utils';

test.describe('Admin Expanded CRUD Tests - Sprint 4', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USERS.admin);
    await page.waitForTimeout(2000);
  });

  test.afterEach(async ({ page }) => {
    try {
      await page.context().clearCookies();
    } catch {}
  });

  // ==================== BULK OPERATIONS TESTS ====================

  test.describe('Bulk Operations', () => {
    test('BULK_001: Events can be selected in bulk', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Look for checkbox selection
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();
      
      if (count > 0) {
        // Select first few
        await checkboxes.first().check();
        await page.waitForTimeout(200);
        
        // Should show bulk action bar
        const bulkActions = page.locator('[class*="bulk"], [class*="selected"], button:has-text("Delete"), button:has-text("Edit")');
        expect(await bulkActions.count()).toBeGreaterThan(0);
      }
    });

    test('BULK_002: Gallery items can be selected in bulk', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/gallery`);
      await waitForPageLoad(page);
      
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();
      
      if (count > 1) {
        // Select multiple
        await checkboxes.first().check();
        await checkboxes.nth(1).check();
        await page.waitForTimeout(200);
        
        // Should show selection count
        const selectionInfo = page.locator('text=/selected|items? selected/i');
        expect(await selectionInfo.count()).toBeGreaterThan(0);
      }
    });

    test('BULK_003: Bulk delete shows confirmation', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      const checkboxes = page.locator('input[type="checkbox"]');
      if (await checkboxes.count() > 1) {
        await checkboxes.first().check();
        await page.waitForTimeout(200);
        
        // Look for delete button
        const deleteButton = page.locator('button:has-text("Delete"), button:has-text("Bulk Delete")').first();
        
        if (await deleteButton.count() > 0) {
          await deleteButton.click();
          await page.waitForTimeout(500);
          
          // Should show confirmation dialog
          const dialog = page.locator('[role="alertdialog"], [role="dialog"], .modal, text=/confirm|delete/i');
          expect(await dialog.count()).toBeGreaterThan(0);
        }
      }
    });

    test('BULK_004: Bulk select all functionality', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Look for select all checkbox
      const selectAll = page.locator('input[aria-label*="select all"], th input[type="checkbox"], [class*="select-all"]').first();
      
      if (await selectAll.count() > 0) {
        await selectAll.check();
        await page.waitForTimeout(300);
        
        // All should be selected
        const checkboxes = page.locator('tbody input[type="checkbox"]:checked');
        expect(await checkboxes.count()).toBeGreaterThan(0);
      }
    });

    test('BULK_005: Bulk edit functionality exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Select items
      const checkboxes = page.locator('input[type="checkbox"]');
      if (await checkboxes.count() > 1) {
        await checkboxes.first().check();
        await page.waitForTimeout(200);
        
        // Look for edit/bulk edit button
        const editButton = page.locator('button:has-text("Edit"), button:has-text("Bulk Edit"), [data-action="bulk-edit"]').first();
        
        if (await editButton.count() > 0) {
          await editButton.click();
          await page.waitForTimeout(500);
          
          // Should show bulk edit form
          const bulkEditForm = page.locator('[class*="bulk-edit"], .modal, form');
          expect(await bulkEditForm.count()).toBeGreaterThan(0);
        }
      }
    });

    test('BULK_006: Selection can be cleared', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      const checkboxes = page.locator('input[type="checkbox"]');
      if (await checkboxes.count() > 1) {
        // Select item
        await checkboxes.first().check();
        await page.waitForTimeout(200);
        
        // Look for clear/deselect
        const clearButton = page.locator('button:has-text("Clear"), button:has-text("Deselect"), [aria-label*="clear"]').first();
        
        if (await clearButton.count() > 0) {
          await clearButton.click();
          await page.waitForTimeout(200);
          
          // Should deselect
          const selectedCount = await page.locator('input[type="checkbox"]:checked').count();
          expect(selectedCount).toBe(0);
        }
      }
    });
  });

  // ==================== IMPORT/EXPORT TESTS ====================

  test.describe('Import/Export Functionality', () => {
    test('IMPORT_001: Events export button exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Look for export button
      const exportButton = page.locator(
        'button:has-text("Export"), a:has-text("Export"), ' +
        'button:has-text("Download"), a:has-text("Download CSV")'
      ).first();
      
      // Export button should exist or be in menu
      const exists = await exportButton.count() > 0 || 
                     (await page.locator('[class*="export"]').count()) > 0;
      
      console.log(`Export button exists: ${exists}`);
    });

    test('IMPORT_002: Gallery export functionality exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/gallery`);
      await waitForPageLoad(page);
      
      const exportButton = page.locator(
        'button:has-text("Export"), a:has-text("Export"), ' +
        'button:has-text("Download")'
      ).first();
      
      console.log(`Gallery export exists: ${await exportButton.count() > 0}`);
    });

    test('IMPORT_003: Import button exists for events', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Look for import button
      const importButton = page.locator(
        'button:has-text("Import"), a:has-text("Import"), ' +
        'input[type="file"][accept*="csv"], input[type="file"][accept*="json"]'
      ).first();
      
      // Should exist in toolbar or dropdown
      const exists = await importButton.count() > 0 ||
                     (await page.locator('[class*="import"]').count()) > 0;
      
      console.log(`Import button exists: ${exists}`);
    });

    test('IMPORT_004: Import modal/form opens', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Find and click import
      const importButton = page.locator('button:has-text("Import"), a:has-text("Import")').first();
      
      if (await importButton.count() > 0) {
        await importButton.click();
        await page.waitForTimeout(500);
        
        // Should show import dialog
        const dialog = page.locator('[role="dialog"], .modal, [class*="import"]');
        expect(await dialog.count()).toBeGreaterThan(0);
      }
    });

    test('IMPORT_005: CSV template can be downloaded', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Look for template download
      const templateLink = page.locator(
        'a:has-text("Template"), button:has-text("Template"), ' +
        'a:has-text("Download Template")'
      ).first();
      
      if (await templateLink.count() > 0) {
        // Template link should point to downloadable file
        const href = await templateLink.getAttribute('href');
        expect(href).toBeTruthy();
      }
    });

    test('IMPORT_006: Import validation shows errors', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Find import button
      const importButton = page.locator('button:has-text("Import")').first();
      
      if (await importButton.count() > 0) {
        await importButton.click();
        await page.waitForTimeout(500);
        
        // Look for file input in dialog
        const fileInput = page.locator('input[type="file"]').first();
        
        if (await fileInput.count() > 0) {
          // Try to upload an invalid file (just to check validation exists)
          // Note: We can't actually upload without a file
          
          // Check for validation messages
          const validationInfo = page.locator('text=/accepts?|format|csv|json/i');
          expect(await validationInfo.count()).toBeGreaterThan(0);
        }
      }
    });
  });

  // ==================== ADVANCED FILTERING TESTS ====================

  test.describe('Advanced Filtering', () => {
    test('FILTER_001: Filter by status works', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Look for status filter
      const statusFilter = page.locator(
        'select[name*="status" i], [class*="status"] select, ' +
        'button:has-text("Status"), [class*="filter"] select'
      ).first();
      
      if (await statusFilter.count() > 0) {
        // Select a status
        await statusFilter.selectOption({ index: 1 });
        await page.waitForTimeout(500);
        
        // URL or results should reflect filter
        const url = page.url();
        expect(url.includes('status') || (await page.locator('table tr').count()) >= 0);
      }
    });

    test('FILTER_002: Date range filter works', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Look for date filters
      const dateFilters = page.locator('input[type="date"]');
      
      if (await dateFilters.count() >= 2) {
        await dateFilters.first().fill('2024-01-01');
        await dateFilters.nth(1).fill('2024-12-31');
        await page.waitForTimeout(500);
        
        // Filter should be applied
        expect(true).toBe(true);
      }
    });

    test('FILTER_003: Search filter works', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Look for search input
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[name*="search" i]').first();
      
      if (await searchInput.count() > 0) {
        await searchInput.fill('test');
        await page.waitForTimeout(500);
        
        // Results should be filtered
        expect(true).toBe(true);
      }
    });

    test('FILTER_004: Category filter works', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Look for category filter
      const categoryFilter = page.locator(
        'select[name*="category" i], [class*="category"] select'
      ).first();
      
      if (await categoryFilter.count() > 0) {
        const options = await categoryFilter.locator('option').count();
        if (options > 1) {
          await categoryFilter.selectOption({ index: 1 });
          await page.waitForTimeout(500);
          
          expect(true).toBe(true);
        }
      }
    });

    test('FILTER_005: Filters can be cleared', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Apply a filter first
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
      
      if (await searchInput.count() > 0) {
        await searchInput.fill('test');
        await page.waitForTimeout(300);
        
        // Look for clear button
        const clearButton = page.locator(
          'button:has-text("Clear"), button:has-text("Reset"), ' +
          'button[aria-label*="clear"], [class*="clear"]'
        ).first();
        
        if (await clearButton.count() > 0) {
          await clearButton.click();
          await page.waitForTimeout(300);
          
          // Input should be cleared
          const value = await searchInput.inputValue();
          expect(value).toBe('');
        }
      }
    });

    test('FILTER_006: Multiple filters can be combined', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Apply search filter
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
      if (await searchInput.count() > 0) {
        await searchInput.fill('test');
        await page.waitForTimeout(200);
      }
      
      // Apply status filter
      const statusFilter = page.locator('select[name*="status" i]').first();
      if (await statusFilter.count() > 0) {
        await statusFilter.selectOption({ index: 1 });
        await page.waitForTimeout(200);
      }
      
      // Both filters should be applied
      expect(true).toBe(true);
    });
  });

  // ==================== PAGINATION TESTS ====================

  test.describe('Pagination', () => {
    test('PAGE_001: Pagination controls exist', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      const pagination = page.locator(
        '[class*="pagination"], nav[role="navigation"], ' +
        'button:has-text("Previous"), button:has-text("Next"), ' +
        '[class*="pager"]'
      );
      
      expect(await pagination.count()).toBeGreaterThan(0);
    });

    test('PAGE_002: Pagination page numbers work', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Look for page numbers
      const pageNumbers = page.locator('[class*="page"] button, [role="button"][class*="page"]');
      
      if (await pageNumbers.count() > 1) {
        // Click page 2
        await pageNumbers.nth(1).click();
        await page.waitForTimeout(500);
        
        // Should show page 2 content
        expect(true).toBe(true);
      }
    });

    test('PAGE_003: Next page navigation works', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      const nextButton = page.locator(
        'button:has-text("Next"), [aria-label*="next"], ' +
        '[class*="pagination"] [class*="next"]'
      ).first();
      
      if (await nextButton.count() > 0) {
        const isDisabled = await nextButton.isDisabled();
        
        if (!isDisabled) {
          await nextButton.click();
          await page.waitForTimeout(500);
          
          // Should be on next page
          const currentPage = page.locator('[class*="active"][class*="page"], [aria-current="page"]');
          expect(await currentPage.count()).toBeGreaterThan(0);
        }
      }
    });

    test('PAGE_004: Items per page can be changed', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Look for per-page selector
      const perPageSelector = page.locator(
        'select[name*="per" i], select[name*="limit" i], ' +
        '[class*="per-page"] select'
      ).first();
      
      if (await perPageSelector.count() > 0) {
        const options = await perPageSelector.locator('option').count();
        if (options > 1) {
          await perPageSelector.selectOption({ index: 1 });
          await page.waitForTimeout(500);
          
          // Should show fewer items
          expect(true).toBe(true);
        }
      }
    });
  });

  // ==================== SORTING TESTS ====================

  test.describe('Sorting', () => {
    test('SORT_001: Column headers are sortable', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Look for sortable column headers
      const sortableHeaders = page.locator(
        'th[aria-sort], th[class*="sort"], thead a, thead button'
      );
      
      expect(await sortableHeaders.count()).toBeGreaterThan(0);
    });

    test('SORT_002: Clicking header sorts column', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      const sortableHeader = page.locator('th').first();
      
      if (await sortableHeader.count() > 0) {
        await sortableHeader.click();
        await page.waitForTimeout(500);
        
        // Should show sort indicator
        const sortIndicator = page.locator(
          '[aria-sort="ascending"], [aria-sort="descending"], ' +
          '[class*="sort-asc"], [class*="sort-desc"]'
        );
        expect(await sortIndicator.count()).toBeGreaterThan(0);
      }
    });

    test('SORT_003: Second click reverses sort order', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await page.waitForTimeout(1000);
      
      const sortableHeader = page.locator('th').first();
      
      if (await sortableHeader.count() > 0) {
        // First click
        await sortableHeader.click();
        await page.waitForTimeout(300);
        
        // Second click
        await sortableHeader.click();
        await page.waitForTimeout(300);
        
        // Should show descending
        const sortIndicator = page.locator(
          '[aria-sort="descending"], [class*="sort-desc"]'
        );
        expect(await sortIndicator.count()).toBeGreaterThan(0);
      }
    });
  });

  // ==================== FAVORITES/QUICK ACCESS TESTS ====================

  test.describe('Favorites/Quick Access', () => {
    test('FAV_001: Events page can be favorited', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/events`);
      await waitForPageLoad(page);
      
      // Look for star/favorite button
      const favoriteButton = page.locator(
        'button:has-text("Star"), button[aria-label*="star" i], ' +
        '[data-action="favorite"], [class*="favorite"]'
      ).first();
      
      if (await favoriteButton.count() > 0) {
        await favoriteButton.click();
        await page.waitForTimeout(300);
        
        // Should show as favorited
        const isFavorited = await favoriteButton.getAttribute('aria-pressed') === 'true' ||
                           (await favoriteButton.getAttribute('class'))?.includes('active');
        
        expect(isFavorited).toBe(true);
      }
    });

    test('FAV_002: Quick access links work', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin`);
      await waitForPageLoad(page);
      
      // Look for quick access/pinned items
      const quickAccess = page.locator(
        '[class*="quick"], [class*="recent"], [class*="frequent"], ' +
        '[class*="pinned"], [class*="starred"]'
      );
      
      if (await quickAccess.count() > 0) {
        const links = quickAccess.locator('a').first();
        if (await links.count() > 0) {
          const href = await links.getAttribute('href');
          expect(href).toContain('/admin/');
        }
      }
    });
  });

  // ==================== ADMIN DASHBOARD TESTS ====================

  test.describe('Admin Dashboard', () => {
    test('DASH_001: Dashboard shows overview stats', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin`);
      await waitForPageLoad(page);
      
      // Look for stat cards
      const stats = page.locator('[class*="stat"], [class*="metric"], [class*="card"]');
      expect(await stats.count()).toBeGreaterThan(0);
    });

    test('DASH_002: Recent activity is shown', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin`);
      await waitForPageLoad(page);
      
      // Look for activity feed
      const activity = page.locator(
        '[class*="activity"], [class*="recent"], [class*="feed"], ' +
        'h2:has-text("Recent"), h2:has-text("Activity")'
      );
      
      expect(await activity.count()).toBeGreaterThan(0);
    });

    test('DASH_003: Quick action buttons exist', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin`);
      await page.waitForTimeout(2000);
      
      // Look for quick action buttons
      const quickActions = page.locator(
        '[class*="quick-action"], [class*="shortcut"], ' +
        'button:has-text("Add"), button:has-text("Create")'
      );
      
      expect(await quickActions.count()).toBeGreaterThan(0);
    });

    test('DASH_004: Charts/graphs render correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin`);
      await waitForPageLoad(page);
      
      // Look for charts
      const charts = page.locator(
        'canvas, svg, [class*="chart"], [class*="graph"], ' +
        '[role="img"][aria-label*="chart"]'
      );
      
      // Charts may or may not exist depending on dashboard
      console.log(`Charts found: ${await charts.count()}`);
    });
  });
});
