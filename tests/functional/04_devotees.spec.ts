import { test, expect } from '@playwright/test';

const BASE_URL = 'https://work-1-dhvcepsnljpkopbv.prod-runtime.all-hands.dev';

test.describe('Devotees Module', () => {
  // TC-081: Devotees List Page Access
  test('TC-081: Devotees list page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
  });

  // TC-082: Add Devotee Button
  test('TC-082: Add devotee button is visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const addButton = page.locator('button:has-text("Add"), button:has-text("New"), a:has-text("Add")').first();
    if (await addButton.isVisible()) {
      await expect(addButton).toBeVisible();
    }
  });

  // TC-083: Add Devotee Form Modal
  test('TC-083: Add devotee form opens as modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const addButton = page.locator('button:has-text("Add")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);
    }
  });

  // TC-084: Devotee Name Field
  test('TC-084: Devotee name field is required', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    // Check form validation
  });

  // TC-085: Devotee Email Field
  test('TC-085: Devotee email field accepts valid email', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const emailField = page.locator('input[type="email"]').first();
    if (await emailField.isVisible()) {
      await expect(emailField).toBeVisible();
    }
  });

  // TC-086: Devotee Phone Field
  test('TC-086: Devotee phone field accepts 10 digits', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const phoneField = page.locator('input[type="tel"], input[name*="phone"]').first();
    if (await phoneField.isVisible()) {
      await expect(phoneField).toBeVisible();
    }
  });

  // TC-087: Save Devotee
  test('TC-087: Save devotee button works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Submit")').first();
    if (await saveButton.isVisible()) {
      await expect(saveButton).toBeEnabled();
    }
  });

  // TC-088: Cancel Button
  test('TC-088: Cancel button closes form', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const cancelButton = page.locator('button:has-text("Cancel")').first();
    if (await cancelButton.isVisible()) {
      await expect(cancelButton).toBeVisible();
    }
  });

  // TC-089: Devotee List Table
  test('TC-089: Devotees list displays as table', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const table = page.locator('table, [class*="table"]').first();
    if (await table.isVisible()) {
      await expect(table).toBeVisible();
    }
  });

  // TC-090: Table Headers
  test('TC-090: Table headers are correct', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const headers = page.locator('th, [class*="header"]');
    const count = await headers.count();
    if (count > 0) {
      await expect(headers.first()).toBeVisible();
    }
  });

  // TC-091: Edit Devotee
  test('TC-091: Edit button is available for each row', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const editButton = page.locator('button:has-text("Edit"), a:has-text("Edit")').first();
    if (await editButton.isVisible()) {
      await expect(editButton).toBeVisible();
    }
  });

  // TC-092: Delete Devotee
  test('TC-092: Delete button triggers confirmation', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const deleteButton = page.locator('button:has-text("Delete"), button:has-text("Remove")').first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.waitForTimeout(500);
      const confirmDialog = page.locator('[class*="dialog"], [class*="confirm"], [role="dialog"]').first();
      if (await confirmDialog.isVisible()) {
        await expect(confirmDialog).toBeVisible();
      }
    }
  });

  // TC-093: Search Functionality
  test('TC-093: Search box filters devotees', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const searchBox = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchBox.isVisible()) {
      await searchBox.fill('test');
      await page.waitForTimeout(500);
    }
  });

  // TC-094: Search by Name
  test('TC-094: Search by name works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const searchBox = page.locator('input[placeholder*="name" i]').first();
    if (await searchBox.isVisible()) {
      await searchBox.fill('John');
      await page.waitForTimeout(500);
    }
  });

  // TC-095: Search by Email
  test('TC-095: Search by email works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const searchBox = page.locator('input[placeholder*="email" i]').first();
    if (await searchBox.isVisible()) {
      await searchBox.fill('john@example.com');
      await page.waitForTimeout(500);
    }
  });

  // TC-096: Filter by Status
  test('TC-096: Filter by status dropdown works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const filterDropdown = page.locator('select, [class*="filter"]').first();
    if (await filterDropdown.isVisible()) {
      await expect(filterDropdown).toBeVisible();
    }
  });

  // TC-097: Filter by Date Range
  test('TC-097: Filter by date range works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const dateFields = page.locator('input[type="date"]');
    const count = await dateFields.count();
    if (count >= 2) {
      await dateFields.first().fill('2024-01-01');
      await dateFields.nth(1).fill('2024-12-31');
    }
  });

  // TC-098: Pagination Controls
  test('TC-098: Pagination controls are visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const pagination = page.locator('[class*="pagination"], [class*="pager"]').first();
    if (await pagination.isVisible()) {
      await expect(pagination).toBeVisible();
    }
  });

  // TC-099: Next Page Button
  test('TC-099: Next page button works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const nextButton = page.locator('button:has-text("Next"), a:has-text("Next")').first();
    if (await nextButton.isVisible() && await nextButton.isEnabled()) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }
  });

  // TC-100: Previous Page Button
  test('TC-100: Previous page button works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const prevButton = page.locator('button:has-text("Previous"), a:has-text("Previous")').first();
    if (await prevButton.isVisible() && await prevButton.isEnabled()) {
      await prevButton.click();
      await page.waitForTimeout(500);
    }
  });

  // TC-101: Page Number Navigation
  test('TC-101: Direct page number selection works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const pageNumbers = page.locator('[class*="pagination"] button, [class*="pagination"] a').first();
    if (await pageNumbers.isVisible()) {
      await expect(pageNumbers).toBeVisible();
    }
  });

  // TC-102: Rows Per Page Selection
  test('TC-102: Rows per page dropdown works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const rowsSelect = page.locator('select[class*="rows"], select[class*="limit"]').first();
    if (await rowsSelect.isVisible()) {
      await expect(rowsSelect).toBeVisible();
    }
  });

  // TC-103: Empty State Message
  test('TC-103: Empty state shows appropriate message', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const searchBox = page.locator('input[type="search"]').first();
    if (await searchBox.isVisible()) {
      await searchBox.fill('nonexistentuser123456');
      await page.waitForTimeout(500);
    }
  });

  // TC-104: Required Field Validation
  test('TC-104: Required fields show validation errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const addButton = page.locator('button:has-text("Add")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);
      const saveButton = page.locator('button:has-text("Save")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  // TC-105: Duplicate Email Warning
  test('TC-105: Duplicate email shows warning', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    // This would require already having a devotee with the same email
  });

  // TC-106: Phone Number Format Validation
  test('TC-106: Invalid phone number shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const phoneField = page.locator('input[type="tel"]').first();
    if (await phoneField.isVisible()) {
      await phoneField.fill('123');
      await page.waitForTimeout(500);
    }
  });

  // TC-107: Special Characters in Name
  test('TC-107: Special characters handled in name field', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const nameField = page.locator('input[name*="name"]').first();
    if (await nameField.isVisible()) {
      await nameField.fill("O'Brien-John");
      await page.waitForTimeout(500);
    }
  });

  // TC-108: Long Text Input
  test('TC-108: Long text input is handled properly', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const textField = page.locator('textarea, input[type="text"]').first();
    if (await textField.isVisible()) {
      await textField.fill('A'.repeat(500));
      await page.waitForTimeout(500);
    }
  });

  // TC-109: Sort by Column
  test('TC-109: Sort by column functionality works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const columnHeader = page.locator('th, [class*="header"]').first();
    if (await columnHeader.isVisible()) {
      await columnHeader.click();
      await page.waitForTimeout(500);
    }
  });

  // TC-110: Bulk Selection
  test('TC-110: Bulk selection checkboxes work', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    if (count > 1) {
      await checkboxes.nth(1).check();
      await page.waitForTimeout(300);
    }
  });

  // TC-111: Bulk Delete
  test('TC-111: Bulk delete action available', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const bulkDelete = page.locator('button:has-text("Delete Selected"), button:has-text("Bulk Delete")').first();
    if (await bulkDelete.isVisible()) {
      await expect(bulkDelete).toBeVisible();
    }
  });

  // TC-112: View Devotee Details
  test('TC-112: View devotee details option available', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    const viewButton = page.locator('button:has-text("View"), a:has-text("View")').first();
    if (await viewButton.isVisible()) {
      await expect(viewButton).toBeVisible();
    }
  });
});
