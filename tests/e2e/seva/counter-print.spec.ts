import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { createFakeSevaApi } from "./fixtures/fake-api";
import { openCounter, threeDateOrder } from "./fixtures/counter";

/**
 * The print job (plan A4-1, Design Book 9.8, 10.2): one page per slip, each 99 x 210 mm. window.print is stubbed; the
 * slips stay in #seva-print-root until 'afterprint', so the page can be rendered to PDF with the print stylesheet.
 */

const MM_TO_PT = 72 / 25.4;

test("prints one 99 x 210 mm page per slip", async ({ page, browserName }) => {
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
    expect(Math.abs(width - 99 * MM_TO_PT)).toBeLessThanOrEqual(1);
    expect(Math.abs(height - 210 * MM_TO_PT)).toBeLessThanOrEqual(1);
  }
});
