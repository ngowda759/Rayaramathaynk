import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import type { SlipSettings } from "../../../types/seva";
import { DEFAULT_SLIP } from "./fixtures/data";
import { createFakeSevaApi } from "./fixtures/fake-api";
import { openCounter, threeDateOrder } from "./fixtures/counter";

/**
 * The print job (plan A4-1, Design Book 9.8, 10.2): one page per slip, on the configured paper (plan A4S-7) - A5,
 * 148 x 210 mm, by default. window.print is stubbed; the slips stay in #seva-print-root until 'afterprint', so the page
 * can be rendered to PDF with the print stylesheet.
 */

const MM_TO_PT = 72 / 25.4;

test("prints one 148 x 210 mm (A5) page per slip by default", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "page.pdf needs Chromium");
  const fake = createFakeSevaApi();
  await openCounter(page, fake);

  await threeDateOrder(page);
  await expect(page.getByTestId("printed-receipt-no")).toHaveCount(3);
  await expect(page.locator("#seva-print-root .slip")).toHaveCount(3);

  await page.emulateMedia({ media: "print" });
  const pdf = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
  expect(pdf.getPageCount()).toBe(3);
  for (const p of pdf.getPages()) {
    const { width, height } = p.getSize();
    expect(Math.abs(width - 148 * MM_TO_PT)).toBeLessThanOrEqual(1);
    expect(Math.abs(height - 210 * MM_TO_PT)).toBeLessThanOrEqual(1);
  }
});

test("prints each slip on an 80 mm wide page after choosing roll_80", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "page.pdf needs Chromium");
  const fake = createFakeSevaApi();
  (fake.state.settings as { slip: SlipSettings }).slip = { ...DEFAULT_SLIP, paperSize: "roll_80" };
  await openCounter(page, fake);

  await threeDateOrder(page);
  await expect(page.getByTestId("printed-receipt-no")).toHaveCount(3);
  await expect(page.locator("#seva-print-root .slip")).toHaveCount(3);

  await page.emulateMedia({ media: "print" });
  const pdf = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
  expect(pdf.getPageCount()).toBe(3);
  for (const p of pdf.getPages()) {
    const { width, height } = p.getSize();
    expect(Math.abs(width - 80 * MM_TO_PT)).toBeLessThanOrEqual(1);
    // Portrait: the fitted roll page is at least as long as it is wide.
    expect(height).toBeGreaterThanOrEqual(width);
  }
});
