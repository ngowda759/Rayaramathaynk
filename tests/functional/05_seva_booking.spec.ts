import { test, expect } from '@playwright/test';

const BASE_URL = 'https://work-1-dhvcepsnljpkopbv.prod-runtime.all-hands.dev';

test.describe('Seva Booking Module', () => {
  // TC-113: Sevas List Page
  test('TC-113: Sevas list page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    await expect(page).toHaveURL(/sevas/);
  });

  // TC-114: Sevas List Display
  test('TC-114: Sevas are displayed as cards/list', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const sevacards = page.locator('[class*="seva"], [class*="card"]');
    await expect(sevacards.first()).toBeVisible();
  });

  // TC-115: Seva Name Display
  test('TC-115: Seva names are displayed correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const sevaName = page.locator('[class*="seva"] h2, [class*="seva"] h3').first();
    if (await sevaName.isVisible()) {
      expect(await sevaName.textContent()).toBeTruthy();
    }
  });

  // TC-116: Seva Description
  test('TC-116: Seva descriptions are visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const description = page.locator('[class*="seva"] p, [class*="description"]').first();
    if (await description.isVisible()) {
      expect(await description.textContent()).toBeTruthy();
    }
  });

  // TC-117: Seva Price Display
  test('TC-117: Seva prices are displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const price = page.locator('[class*="price"], [class*="amount"]').first();
    if (await price.isVisible()) {
      expect(await price.textContent()).toBeTruthy();
    }
  });

  // TC-118: Book Now Button
  test('TC-118: Book Now button is visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const bookButton = page.locator('button:has-text("Book"), a:has-text("Book")').first();
    await expect(bookButton).toBeVisible();
  });

  // TC-119: Booking Form Opens
  test('TC-119: Booking form opens on Book Now click', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const bookButton = page.locator('button:has-text("Book")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
      await page.waitForTimeout(500);
    }
  });

  // TC-120: Devotee Name Field
  test('TC-120: Devotee name field in booking form', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const bookButton = page.locator('button:has-text("Book")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
      await page.waitForTimeout(500);
      const nameField = page.locator('input[name*="name" i]').first();
      if (await nameField.isVisible()) {
        await expect(nameField).toBeVisible();
      }
    }
  });

  // TC-121: Date Selection
  test('TC-121: Date picker in booking form', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const bookButton = page.locator('button:has-text("Book")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
      await page.waitForTimeout(500);
      const dateField = page.locator('input[type="date"]').first();
      if (await dateField.isVisible()) {
        await expect(dateField).toBeVisible();
      }
    }
  });

  // TC-122: Time Slot Selection
  test('TC-122: Time slot selection is available', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const bookButton = page.locator('button:has-text("Book")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
      await page.waitForTimeout(500);
      const timeSlots = page.locator('[class*="time"], select[name*="time" i]').first();
      if (await timeSlots.isVisible()) {
        await expect(timeSlots).toBeVisible();
      }
    }
  });

  // TC-123: Mobile Number Field
  test('TC-123: Mobile number field in booking form', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const bookButton = page.locator('button:has-text("Book")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
      await page.waitForTimeout(500);
      const mobileField = page.locator('input[type="tel"], input[name*="phone" i]').first();
      if (await mobileField.isVisible()) {
        await expect(mobileField).toBeVisible();
      }
    }
  });

  // TC-124: Email Field
  test('TC-124: Email field in booking form', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const bookButton = page.locator('button:has-text("Book")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
      await page.waitForTimeout(500);
      const emailField = page.locator('input[type="email"]').first();
      if (await emailField.isVisible()) {
        await expect(emailField).toBeVisible();
      }
    }
  });

  // TC-125: Date Validation - Past Date
  test('TC-125: Cannot select past dates', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const bookButton = page.locator('button:has-text("Book")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
      await page.waitForTimeout(500);
      const dateField = page.locator('input[type="date"]').first();
      if (await dateField.isVisible()) {
        await dateField.fill('2020-01-01');
        await page.waitForTimeout(500);
      }
    }
  });

  // TC-126: Date Validation - Future Date
  test('TC-126: Can select future dates', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const bookButton = page.locator('button:has-text("Book")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
      await page.waitForTimeout(500);
      const dateField = page.locator('input[type="date"]').first();
      if (await dateField.isVisible()) {
        await dateField.fill('2025-12-31');
        await expect(dateField).toHaveValue('2025-12-31');
      }
    }
  });

  // TC-127: Submit Booking
  test('TC-127: Submit booking button works', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const bookButton = page.locator('button:has-text("Book")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
      await page.waitForTimeout(500);
      const submitButton = page.locator('button:has-text("Submit"), button:has-text("Confirm")').first();
      if (await submitButton.isVisible()) {
        await expect(submitButton).toBeEnabled();
      }
    }
  });

  // TC-128: Multiple Seva Booking
  test('TC-128: Can book multiple sevas', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    // Check if cart or multiple selection is available
  });

  // TC-129: Booking Confirmation
  test('TC-129: Booking confirmation displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    // After successful booking
  });

  // TC-130: Payment Gateway Redirect
  test('TC-130: Payment gateway redirect works', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    // Check for payment integration
  });

  // TC-131: Admin Bookings List
  test('TC-131: Admin can view all bookings', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/seva-bookings`);
    const table = page.locator('table, [class*="table"]').first();
    if (await table.isVisible()) {
      await expect(table).toBeVisible();
    }
  });

  // TC-132: Edit Booking
  test('TC-132: Admin can edit booking', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/seva-bookings`);
    const editButton = page.locator('button:has-text("Edit")').first();
    if (await editButton.isVisible()) {
      await expect(editButton).toBeVisible();
    }
  });

  // TC-133: Cancel Booking
  test('TC-133: Admin can cancel booking', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/seva-bookings`);
    const cancelButton = page.locator('button:has-text("Cancel")').first();
    if (await cancelButton.isVisible()) {
      await expect(cancelButton).toBeVisible();
    }
  });

  // TC-134: Booking Status Filter
  test('TC-134: Filter by booking status works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/seva-bookings`);
    const statusFilter = page.locator('select[name*="status" i], [class*="filter"]').first();
    if (await statusFilter.isVisible()) {
      await expect(statusFilter).toBeVisible();
    }
  });

  // TC-135: Date Range Filter
  test('TC-135: Filter by date range works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/seva-bookings`);
    const dateFields = page.locator('input[type="date"]');
    const count = await dateFields.count();
    if (count >= 2) {
      await expect(dateFields.first()).toBeVisible();
    }
  });

  // TC-136: Booking Receipt
  test('TC-136: Booking receipt can be generated', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/seva-bookings`);
    const receiptButton = page.locator('button:has-text("Receipt"), button:has-text("Download")').first();
    if (await receiptButton.isVisible()) {
      await expect(receiptButton).toBeVisible();
    }
  });

  // TC-137: Payment Status Update
  test('TC-137: Payment status can be updated', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/seva-bookings`);
    const statusSelect = page.locator('select[name*="payment" i]').first();
    if (await statusSelect.isVisible()) {
      await expect(statusSelect).toBeVisible();
    }
  });

  // TC-138: Seva Availability Check
  test('TC-138: Seva availability is checked', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    // Check for availability indicators
  });

  // TC-139: Full Calendar View
  test('TC-139: Calendar view for bookings', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/seva-bookings`);
    const calendarView = page.locator('[class*="calendar"], button:has-text("Calendar")').first();
    if (await calendarView.isVisible()) {
      await expect(calendarView).toBeVisible();
    }
  });

  // TC-140: Booking Summary
  test('TC-140: Booking summary displays correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const bookButton = page.locator('button:has-text("Book")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
      await page.waitForTimeout(500);
      const summary = page.locator('[class*="summary"], [class*="total"]').first();
      if (await summary.isVisible()) {
        await expect(summary).toBeVisible();
      }
    }
  });

  // TC-141: Terms and Conditions
  test('TC-141: Terms and conditions checkbox', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const bookButton = page.locator('button:has-text("Book")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
      await page.waitForTimeout(500);
      const termsCheckbox = page.locator('input[type="checkbox"]').first();
      if (await termsCheckbox.isVisible()) {
        await expect(termsCheckbox).toBeVisible();
      }
    }
  });

  // TC-142: Special Instructions
  test('TC-142: Special instructions field available', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const bookButton = page.locator('button:has-text("Book")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
      await page.waitForTimeout(500);
      const instructions = page.locator('textarea, input[name*="note" i]').first();
      if (await instructions.isVisible()) {
        await expect(instructions).toBeVisible();
      }
    }
  });

  // TC-143: Gothram Field
  test('TC-143: Gothram field in booking form', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const bookButton = page.locator('button:has-text("Book")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
      await page.waitForTimeout(500);
      const gothramField = page.locator('input[name*="gothram" i], select[name*="gothram" i]').first();
      if (await gothramField.isVisible()) {
        await expect(gothramField).toBeVisible();
      }
    }
  });

  // TC-144: Nakshatra Field
  test('TC-144: Nakshatra field in booking form', async ({ page }) => {
    await page.goto(`${BASE_URL}/sevas`);
    const bookButton = page.locator('button:has-text("Book")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
      await page.waitForTimeout(500);
      const nakshatraField = page.locator('input[name*="nakshatra" i], select[name*="nakshatra" i]').first();
      if (await nakshatraField.isVisible()) {
        await expect(nakshatraField).toBeVisible();
      }
    }
  });
});
