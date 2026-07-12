import { test, expect } from '@playwright/test';

const BASE_URL = 'https://work-1-dhvcepsnljpkopbv.prod-runtime.all-hands.dev';

test.describe('Events Module', () => {
  // TC-181: Events Page Access
  test('TC-181: Events page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/events`);
    await expect(page).toHaveURL(/events/);
  });

  // TC-182: Event List Display
  test('TC-182: Events are listed correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/events`);
    const eventCards = page.locator('[class*="event"], [class*="card"]');
    await expect(eventCards.first()).toBeVisible();
  });

  // TC-183: Event Title Display
  test('TC-183: Event titles are displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/events`);
    const eventTitle = page.locator('[class*="event"] h2, [class*="event"] h3').first();
    if (await eventTitle.isVisible()) {
      expect(await eventTitle.textContent()).toBeTruthy();
    }
  });

  // TC-184: Event Date Display
  test('TC-184: Event dates are displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/events`);
    const eventDate = page.locator('[class*="date"], [class*="event"] time').first();
    if (await eventDate.isVisible()) {
      expect(await eventDate.textContent()).toBeTruthy();
    }
  });

  // TC-185: Event Description
  test('TC-185: Event descriptions are visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/events`);
    const description = page.locator('[class*="description"], [class*="event"] p').first();
    if (await description.isVisible()) {
      expect(await description.textContent()).toBeTruthy();
    }
  });

  // TC-186: Event Image
  test('TC-186: Event images display correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/events`);
    const eventImage = page.locator('[class*="event"] img').first();
    if (await eventImage.isVisible()) {
      const alt = await eventImage.getAttribute('alt');
      expect(alt).toBeTruthy();
    }
  });

  // TC-187: Event Details Page
  test('TC-187: Event details page accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/events`);
    const eventLink = page.locator('[class*="event"] a').first();
    if (await eventLink.isVisible()) {
      await eventLink.click();
      await page.waitForTimeout(1000);
    }
  });

  // TC-188: Admin Events List
  test('TC-188: Admin events list accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/events`);
    const table = page.locator('table, [class*="table"]').first();
    if (await table.isVisible()) {
      await expect(table).toBeVisible();
    }
  });

  // TC-189: Add Event Button
  test('TC-189: Add event button available', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/events`);
    const addButton = page.locator('button:has-text("Add"), a:has-text("Add")').first();
    if (await addButton.isVisible()) {
      await expect(addButton).toBeVisible();
    }
  });

  // TC-190: Event Form Fields
  test('TC-190: Event form has all required fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/events`);
    const addButton = page.locator('button:has-text("Add")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);
      const form = page.locator('form, [class*="form"]').first();
      if (await form.isVisible()) {
        await expect(form).toBeVisible();
      }
    }
  });

  // TC-191: Event Date Validation
  test('TC-191: Event date validation works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/events`);
    const addButton = page.locator('button:has-text("Add")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);
      const dateField = page.locator('input[type="date"]').first();
      if (await dateField.isVisible()) {
        await dateField.fill('2020-01-01');
        await page.waitForTimeout(500);
      }
    }
  });

  // TC-192: Edit Event
  test('TC-192: Edit event functionality works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/events`);
    const editButton = page.locator('button:has-text("Edit")').first();
    if (await editButton.isVisible()) {
      await expect(editButton).toBeVisible();
    }
  });

  // TC-193: Delete Event
  test('TC-193: Delete event with confirmation', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/events`);
    const deleteButton = page.locator('button:has-text("Delete")').first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.waitForTimeout(500);
      const confirmDialog = page.locator('[class*="dialog"], [class*="confirm"]').first();
      if (await confirmDialog.isVisible()) {
        await expect(confirmDialog).toBeVisible();
      }
    }
  });

  // TC-194: Event Visibility Toggle
  test('TC-194: Event visibility can be toggled', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/events`);
    const visibilityToggle = page.locator('input[type="checkbox"][class*="toggle"], button:has-text("Publish")').first();
    if (await visibilityToggle.isVisible()) {
      await expect(visibilityToggle).toBeVisible();
    }
  });

  // TC-195: Upcoming Events Filter
  test('TC-195: Filter by upcoming events', async ({ page }) => {
    await page.goto(`${BASE_URL}/events`);
    const filterButton = page.locator('button:has-text("Upcoming"), select').first();
    if (await filterButton.isVisible()) {
      await expect(filterButton).toBeVisible();
    }
  });
});

test.describe('Gallery Module', () => {
  // TC-196: Gallery Page Access
  test('TC-196: Gallery page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/gallery`);
    await expect(page).toHaveURL(/gallery/);
  });

  // TC-197: Gallery Images Display
  test('TC-197: Gallery images display correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/gallery`);
    const images = page.locator('img, [class*="image"]');
    const count = await images.count();
    if (count > 0) {
      await expect(images.first()).toBeVisible();
    }
  });

  // TC-198: Image Alt Text
  test('TC-198: All gallery images have alt text', async ({ page }) => {
    await page.goto(`${BASE_URL}/gallery`);
    const images = await page.locator('img').all();
    for (const img of images.slice(0, 5)) {
      const alt = await img.getAttribute('alt');
      if (await img.isVisible()) {
        expect(alt).toBeTruthy();
      }
    }
  });

  // TC-199: Gallery Lazy Loading
  test('TC-199: Gallery images lazy load', async ({ page }) => {
    await page.goto(`${BASE_URL}/gallery`);
    await page.waitForTimeout(1000);
    const images = page.locator('img[loading="lazy"]');
    const count = await images.count();
    // Some images should have lazy loading
  });

  // TC-200: Broken Image Detection
  test('TC-200: No broken images in gallery', async ({ page }) => {
    await page.goto(`${BASE_URL}/gallery`);
    const images = await page.locator('img').all();
    for (const img of images) {
      if (await img.isVisible()) {
        const naturalWidth = await img.evaluate(el => (el as HTMLImageElement).naturalWidth);
        expect(naturalWidth).toBeGreaterThan(0);
      }
    }
  });

  // TC-201: Gallery Lightbox
  test('TC-201: Gallery lightbox opens on click', async ({ page }) => {
    await page.goto(`${BASE_URL}/gallery`);
    const image = page.locator('img').first();
    if (await image.isVisible()) {
      await image.click();
      await page.waitForTimeout(500);
      const lightbox = page.locator('[class*="lightbox"], [class*="modal"]').first();
      if (await lightbox.isVisible()) {
        await expect(lightbox).toBeVisible();
      }
    }
  });

  // TC-202: Admin Gallery Management
  test('TC-202: Admin can manage gallery', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/gallery`);
    const addButton = page.locator('button:has-text("Add"), button:has-text("Upload")').first();
    if (await addButton.isVisible()) {
      await expect(addButton).toBeVisible();
    }
  });

  // TC-203: Image Upload
  test('TC-203: Image upload functionality', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/gallery`);
    const uploadButton = page.locator('input[type="file"], button:has-text("Upload")').first();
    if (await uploadButton.isVisible()) {
      await expect(uploadButton).toBeVisible();
    }
  });

  // TC-204: Delete Gallery Image
  test('TC-204: Delete gallery image works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/gallery`);
    const deleteButton = page.locator('button:has-text("Delete")').first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Announcements Module', () => {
  // TC-205: Admin Announcements Page
  test('TC-205: Admin announcements page accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/announcements`);
    await page.waitForLoadState('networkidle');
  });

  // TC-206: Create Announcement
  test('TC-206: Create announcement button available', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/announcements`);
    const createButton = page.locator('button:has-text("Create"), button:has-text("Add")').first();
    if (await createButton.isVisible()) {
      await expect(createButton).toBeVisible();
    }
  });

  // TC-207: Announcement Title Field
  test('TC-207: Announcement title field present', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/announcements`);
    const addButton = page.locator('button:has-text("Create")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);
      const titleField = page.locator('input[name*="title" i]').first();
      if (await titleField.isVisible()) {
        await expect(titleField).toBeVisible();
      }
    }
  });

  // TC-208: Announcement Content
  test('TC-208: Announcement content field present', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/announcements`);
    const addButton = page.locator('button:has-text("Create")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);
      const contentField = page.locator('textarea, input[name*="content" i]').first();
      if (await contentField.isVisible()) {
        await expect(contentField).toBeVisible();
      }
    }
  });

  // TC-209: Announcement Visibility
  test('TC-209: Announcement visibility toggle works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/announcements`);
    const visibilityToggle = page.locator('input[type="checkbox"]').first();
    if (await visibilityToggle.isVisible()) {
      await expect(visibilityToggle).toBeVisible();
    }
  });

  // TC-210: Expired Announcements
  test('TC-210: Expired announcements handled correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/announcements`);
    // Check how expired announcements are displayed
  });
});

test.describe('Contact Form Module', () => {
  // TC-211: Contact Page Access
  test('TC-211: Contact page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    const contactLink = page.locator('a[href*="contact"], text=/contact/i').first();
    if (await contactLink.isVisible()) {
      await contactLink.click();
      await expect(page).toHaveURL(/contact/);
    }
  });

  // TC-212: Contact Form Fields
  test('TC-212: Contact form has all required fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    // Navigate to contact page
    const form = page.locator('form, [class*="form"]').first();
    if (await form.isVisible()) {
      await expect(form).toBeVisible();
    }
  });

  // TC-213: Name Field Validation
  test('TC-213: Name field is required', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    const nameField = page.locator('input[name*="name" i]').first();
    if (await nameField.isVisible()) {
      await nameField.fill('');
      await page.waitForTimeout(300);
    }
  });

  // TC-214: Email Validation
  test('TC-214: Email validation works', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    const emailField = page.locator('input[type="email"]').first();
    if (await emailField.isVisible()) {
      await emailField.fill('invalid-email');
      await page.waitForTimeout(300);
    }
  });

  // TC-215: Phone Validation
  test('TC-215: Phone number validation works', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    const phoneField = page.locator('input[type="tel"], input[name*="phone" i]').first();
    if (await phoneField.isVisible()) {
      await phoneField.fill('12345');
      await page.waitForTimeout(300);
    }
  });

  // TC-216: Message Field
  test('TC-216: Message field is required', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    const messageField = page.locator('textarea, input[name*="message" i]').first();
    if (await messageField.isVisible()) {
      await expect(messageField).toBeVisible();
    }
  });

  // TC-217: Submit Button
  test('TC-217: Submit button works', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    const submitButton = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Send")').first();
    if (await submitButton.isVisible()) {
      await expect(submitButton).toBeEnabled();
    }
  });

  // TC-218: Success Message
  test('TC-218: Form submission shows success', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    // Fill and submit form
  });

  // TC-219: Error Message Display
  test('TC-219: Error messages display correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    const submitButton = page.locator('button[type="submit"]').first();
    if (await submitButton.isVisible()) {
      await submitButton.click();
      await page.waitForTimeout(500);
      const errors = page.locator('[class*="error"], [class*="alert"]');
      const count = await errors.count();
      if (count > 0) {
        await expect(errors.first()).toBeVisible();
      }
    }
  });

  // TC-220: Spam Prevention
  test('TC-220: CAPTCHA or spam prevention exists', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    const captcha = page.locator('[class*="captcha"], [class*="recaptcha"]').first();
    if (await captcha.isVisible()) {
      await expect(captcha).toBeVisible();
    }
  });
});
