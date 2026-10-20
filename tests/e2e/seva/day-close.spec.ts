import { expect, test, type Page } from "@playwright/test";
import { businessDate } from "../../../lib/seva/time";
import type { DayClosePrep } from "../../../types/seva-dayclose";
import { signInAs } from "./fixtures/auth";
import { createFakeSevaApi, type FakeSevaApi } from "./fixtures/fake-api";
import { SEVA_ROUTES } from "../../../lib/seva/routes";

/**
 * Close day (plan A4-3, DB §9.10). Every /api/seva/** call is answered by the fake API; this file adds the close-day
 * answers in the real wire shape (DayClosePrep) on top of the fake's built-in close and reopen.
 */

const PAGE = SEVA_ROUTES.dayClose;
/** The page makes the Excel copy only for the counter's own business day, so the fake's day is today (IST). */
const TODAY = businessDate(new Date());

function prep(fake: FakeSevaApi, over: Partial<DayClosePrep> = {}): DayClosePrep {
  return {
    counterId: 1,
    businessDate: TODAY,
    status: fake.state.dayClosed ? "closed" : "open",
    openingFloatPaise: 0,
    receipts: 12,
    cancelled: 1,
    changed: 0,
    cashExpectedPaise: 152_000,
    upiCount: 0,
    upiExpectedPaise: 0,
    outboxPending: 0,
    seriesRanges: [
      { series: "C1", first: "C1-023-10-2026/000101", last: "C1-023-10-2026/000113", issued: 12, cancelled: 1, openGaps: 0 },
    ],
    denominations: [
      { kind: "note", valuePaise: 50_000 },
      { kind: "note", valuePaise: 1_000 },
      { kind: "coin", valuePaise: 1_000 },
      { kind: "coin", valuePaise: 100 },
    ],
    ...over,
  };
}

/**
 * Makes this browser a registered counter PC: device credentials in the counter's IndexedDB (lib/seva/offline/device.ts)
 * and one sent local receipt of `day` (lib/seva/offline/local-receipts.ts), as the counter screen would keep it.
 */
async function registerThisPc(page: Page, day: string): Promise<void> {
  await page.evaluate(
    (today) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("seva-counter");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(["meta", "today"], "readwrite");
          tx.objectStore("meta").put({ deviceId: "device-e2e-1", secret: "A".repeat(43) }, "device");
          tx.objectStore("today").put({
            id: "receipt-e2e-1",
            clientReceiptId: "client-e2e-1",
            receiptNo: "C1-023-10-2026/000101",
            seriesCode: "C1",
            sevaDate: today,
            groupNo: "G-e2e-1",
            position: 1,
            count: 1,
            orderTotalPaise: 15_000,
            totalPaise: 15_000,
            lines: [
              {
                lineNo: 1,
                sevaId: "seva-e2e-1",
                code: "AR",
                nameEn: "Archana",
                nameKn: null,
                quantity: 1,
                unitRatePaise: 15_000,
                amountPaise: 15_000,
                changed: false,
                prasadamItems: null,
              },
            ],
            payment: { mode: "cash" },
            devotee: { name: "Ramesh" },
            qrToken: "token-e2e-1",
            issuedAt: `${today}T04:30:00.000Z`,
            issuedBy: { name: "Lakshmi R", staffNo: 23 },
            counterName: "Counter 1",
            channel: "counter",
            issuedOffline: false,
            status: "issued",
            printCount: 1,
            prasadam: "none",
            businessDate: today,
            sent: true,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    day,
  );
}

async function stubPrint(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __prints: number; print: () => void };
    w.__prints = 0;
    w.print = () => {
      w.__prints += 1;
    };
  });
}

test("cannot close while receipts are waiting to send", async ({ page }) => {
  const fake = createFakeSevaApi();
  fake.extend({ "GET day-close": () => prep(fake, { outboxPending: 2 }) });
  await fake.install(page);
  await signInAs(page, "receptionist", { redirect: PAGE });

  await expect(page.getByTestId("dc-sent")).toContainText("2 receipts are waiting to send", { timeout: 60_000 });
  await page.getByLabel("Count of Rs 500 notes").fill("3");
  await page.getByLabel("Count of Rs 10 coins").fill("2");
  await expect(page.getByTestId("dc-cash-diff")).toContainText("Matches");

  const close = page.getByRole("button", { name: "Close day and print summary" });
  await expect(close).toBeDisabled();
  await expect(page.getByText("Wait until nothing is waiting to send.")).toBeVisible();
  expect(fake.requests.filter((r) => r.method === "POST" && r.path.startsWith("/api/seva/day-close"))).toHaveLength(0);
});

test("closing prints the summary and saves the Excel copy", async ({ page }) => {
  const fake = createFakeSevaApi();
  fake.extend({ "GET day-close": () => prep(fake) });
  await stubPrint(page);
  await fake.install(page);
  await signInAs(page, "receptionist", { redirect: PAGE });
  await expect(page.getByRole("button", { name: "Close day and print summary" })).toBeVisible({ timeout: 60_000 });

  // This browser becomes the counter PC, so the page sends a heartbeat and keeps the day's Excel copy.
  await registerThisPc(page, TODAY);
  await page.reload();
  await expect(page.getByTestId("dc-sent")).toContainText("Nothing is waiting to send", { timeout: 60_000 });
  expect(fake.requests.some((r) => r.method === "POST" && r.path === "/api/seva/counter/heartbeat")).toBe(true);

  await page.getByLabel("Count of Rs 500 notes").fill("3");
  await page.getByLabel("Count of Rs 10 coins").fill("1");
  await expect(page.getByTestId("dc-cash-diff")).toContainText("Short Rs 10");
  const close = page.getByRole("button", { name: "Close day and print summary" });
  await expect(close).toBeDisabled();
  await page.getByLabel(/Note about the difference/).fill("Rs 10 coin given as change twice");
  await expect(close).toBeEnabled();

  const download = page.waitForEvent("download", { timeout: 60_000 });
  await close.click();
  expect((await download).suggestedFilename()).toBe(`${TODAY} Counter 1.xlsx`);

  await expect(page.getByTestId("dc-done")).toContainText("Day closed at", { timeout: 30_000 });
  await expect(page.getByTestId("dc-done")).toContainText("the Excel copy was downloaded");
  await expect(page.getByRole("heading", { name: /Day closed/ })).toBeVisible();

  const printRoot = page.locator("#seva-print-root");
  await expect(printRoot.getByTestId("dc-summary")).toContainText("Day close summary");
  await expect(printRoot.getByTestId("dc-summary")).toContainText("Rs 10 coin given as change twice");
  expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);

  const posted = fake.requests.filter((r) => r.method === "POST" && r.path === "/api/seva/day-close");
  expect(posted).toHaveLength(1);
  expect(posted[0].body).toMatchObject({
    counterId: 1,
    businessDate: TODAY,
    note: "Rs 10 coin given as change twice",
    counts: expect.arrayContaining([
      { kind: "note", valuePaise: 50_000, count: 3 },
      { kind: "coin", valuePaise: 1_000, count: 1 },
    ]),
  });
});

test("a temple admin can reopen with a reason", async ({ page }) => {
  const fake = createFakeSevaApi({ dayClosed: true });
  fake.extend({
    "GET day-close": () => prep(fake),
    "GET reports/day-closes": () => [{ id: "dayclose-7", counterId: 1, businessDate: TODAY, status: "closed" }],
  });
  await fake.install(page);
  await signInAs(page, "temple_admin", { redirect: PAGE });

  await expect(page.getByRole("heading", { name: /Day closed/ })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Reopen", exact: true }).click();
  const confirm = page.getByRole("button", { name: "Reopen the day" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel(/Reason for reopening/).fill("Late cash offering to count");
  await confirm.click();

  await expect(page.getByTestId("dc-done")).toContainText("The day is open again.", { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Close day and print summary" })).toBeVisible();
  const reopened = fake.requests.filter((r) => r.method === "POST" && r.path === "/api/seva/day-close/reopen");
  expect(reopened).toHaveLength(1);
  expect(reopened[0].body).toEqual({ dayCloseId: "dayclose-7", reason: "Late cash offering to count" });
});

test("closing another counter from a counter PC uses the office's figures, not this PC's", async ({ page }) => {
  const fake = createFakeSevaApi();
  let otherWaiting = 1;
  fake.extend({ "GET day-close": () => prep(fake, { counterId: 2, outboxPending: otherWaiting }) });
  await stubPrint(page);
  await fake.install(page);
  // This browser is Counter 1's PC; the admin entry from Reports - Day closes asks for Counter 2.
  await signInAs(page, "receptionist", { redirect: `${PAGE}?counterId=2` });
  await expect(page.getByRole("button", { name: "Close day and print summary" })).toBeVisible({ timeout: 60_000 });
  await registerThisPc(page, TODAY);
  await page.reload();

  // Step 4 shows Counter 2's waiting count from the office, with no "Send now" for this PC's outbox.
  await expect(page.getByTestId("dc-sent")).toContainText("1 receipt is waiting to send", { timeout: 60_000 });
  await expect(page.getByText("Open the counter page on that PC so they send themselves.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send now" })).toHaveCount(0);
  expect(fake.requests.some((r) => r.method === "POST" && r.path === "/api/seva/counter/heartbeat")).toBe(false);

  // Once Counter 2 has sent, it closes without an Excel copy made from this PC's receipts.
  otherWaiting = 0;
  await page.reload();
  await expect(page.getByTestId("dc-sent")).toContainText("Nothing is waiting to send", { timeout: 60_000 });
  await page.getByLabel("Count of Rs 500 notes").fill("3");
  await page.getByLabel("Count of Rs 10 coins").fill("2");
  let downloads = 0;
  page.on("download", () => {
    downloads += 1;
  });
  await page.getByRole("button", { name: "Close day and print summary" }).click();
  await expect(page.getByTestId("dc-done")).toContainText("no Excel copy was made here", { timeout: 30_000 });
  expect(downloads).toBe(0);
  const posted = fake.requests.filter((r) => r.method === "POST" && r.path === "/api/seva/day-close");
  expect(posted).toHaveLength(1);
  expect(posted[0].body).toMatchObject({ counterId: 2, businessDate: TODAY });
  expect(fake.requests.some((r) => r.method === "POST" && r.path === "/api/seva/counter/heartbeat")).toBe(false);
});
