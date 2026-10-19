import { expect, test, type Page } from "@playwright/test";
import type { DayClosePrep } from "../../../types/seva-dayclose";
import { signInAs } from "./fixtures/auth";
import { createFakeSevaApi, type FakeSevaApi } from "./fixtures/fake-api";

/**
 * Close day (plan A4-3, DB §9.10). Every /api/seva/** call is answered by the fake API; this file adds the close-day
 * answers in the real wire shape (DayClosePrep) on top of the fake's built-in close and reopen.
 */

const PAGE = "/admin/receipts/day-close";

function prep(fake: FakeSevaApi, over: Partial<DayClosePrep> = {}): DayClosePrep {
  return {
    counterId: 1,
    businessDate: "2026-10-19",
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

/** Makes this browser a registered counter PC: device credentials in the counter's IndexedDB (lib/seva/offline/device.ts). */
async function registerThisPc(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("seva-counter");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("meta", "readwrite");
          tx.objectStore("meta").put({ deviceId: "device-e2e-1", secret: "A".repeat(43) }, "device");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
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
  await registerThisPc(page);
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
  expect((await download).suggestedFilename()).toBe("2026-10-19 Counter 1.xlsx");

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
    businessDate: "2026-10-19",
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
    "GET reports/day-closes": () => [{ id: "dayclose-7", counterId: 1, businessDate: "2026-10-19", status: "closed" }],
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
