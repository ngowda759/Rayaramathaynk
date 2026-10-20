import { expect, test } from "@playwright/test";
import type { OutboxItem } from "../../../types/seva";
import { createFakeSevaApi } from "./fixtures/fake-api";
import { openCounter, ordersPosted, printCount, quickOrder } from "./fixtures/counter";

/**
 * The counter offline (plan A4-1, Design Book 8.3, 8.6, 9.11): OF numbers from this PC, the outbox sent on reconnect,
 * the in-doubt question after three unanswered tries, and the "Work offline" switch.
 */

test("works offline with OF numbers and sends them on reconnect", async ({ page, context }) => {
  const fake = createFakeSevaApi();
  await openCounter(page, fake);
  const strip = page.getByRole("region", { name: "Counter status" });

  await context.setOffline(true);
  await expect(strip).toContainText("Offline");
  await quickOrder(page, "Venkatesh Rao", 1);
  await page.keyboard.press("Control+Enter");

  await expect(page.locator("#seva-print-root")).toContainText("OF1-023-");
  await expect(page.getByTestId("printed-receipt-no")).toContainText(/^OF1-023-/);
  await expect(strip).toContainText("1 waiting");
  expect(ordersPosted(fake)).toHaveLength(0);
  expect(await printCount(page)).toBe(1);

  await context.setOffline(false);
  const syncs = () => fake.requests.filter((r) => r.method === "POST" && r.path.startsWith("/api/seva/counter/sync"));
  await expect.poll(() => syncs().length, { timeout: 30_000 }).toBeGreaterThan(0);
  const items = (syncs()[0].body as { items: OutboxItem[] }).items;
  expect(items).toHaveLength(1);
  expect(items[0].kind).toBe("order");
  await expect(page.getByTestId("counter-waiting")).toContainText("0 waiting");
  expect(fake.state.receipts.some((r) => r.receiptNo.startsWith("OF1-023-"))).toBe(true);
});

test("asks before printing offline when the office does not answer", async ({ page }) => {
  const fake = createFakeSevaApi();
  await openCounter(page, fake);
  await quickOrder(page, "Venkatesh Rao", 1);
  for (let i = 0; i < 3; i += 1) fake.failNext("/api/seva/counter/orders", "timeout");

  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("The temple's server did not answer in time")).toBeVisible({ timeout: 30_000 });
  expect(await printCount(page)).toBe(0);
  await page.getByRole("button", { name: "Yes, print offline" }).click();

  await expect(page.locator("#seva-print-root")).toContainText("OF1-023-");
  expect(ordersPosted(fake)).toHaveLength(3);
  expect(await printCount(page)).toBe(1);
});

test("Work offline switch never calls the office", async ({ page }) => {
  const fake = createFakeSevaApi();
  await openCounter(page, fake);
  await page.getByRole("switch", { name: "Work offline" }).click();
  await expect(page.getByRole("region", { name: "Counter status" })).toContainText("Offline");

  await quickOrder(page, "Venkatesh Rao", 1);
  await page.keyboard.press("Control+Enter");

  await expect(page.locator("#seva-print-root")).toContainText("OF1-023-");
  expect(ordersPosted(fake)).toHaveLength(0);
  expect(fake.requests.filter((r) => r.path.startsWith("/api/seva/counter/sync"))).toHaveLength(0);
});
