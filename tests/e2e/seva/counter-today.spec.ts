import { expect, test, type Page } from "@playwright/test";
import type { CounterOrderPayload, IssuedReceipt, IssueResponse } from "../../../types/seva";
import { businessDate } from "../../../lib/seva/time";
import { signInAs, type E2ERole } from "./fixtures/auth";
import { createFakeSevaApi, type FakeSevaApi } from "./fixtures/fake-api";
import { SEVA_ROUTES } from "../../../lib/seva/routes";

/**
 * Today's receipts at the counter (plan A4-2; DB §9.8-9.9): DUPLICATE reprint, no reprint of a cancelled receipt,
 * the spoiled-print reissue, a group cancel of one date, and an offline cancel that waits in the outbox and goes to
 * the office on reconnect. Every /api/seva/** call is answered by the fake API.
 */

const TODAY_PATH = SEVA_ROUTES.today;

let orderSeq = 0;

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Issues an order through the fake as `role` would at the counter, so the fake knows who issued it. */
async function issue(api: FakeSevaApi, role: E2ERole, dates: number[], name = "Lakshmi Narayan"): Promise<IssuedReceipt[]> {
  const today = businessDate(new Date());
  orderSeq += 1;
  const body: CounterOrderPayload = {
    clientOrderId: `00000000-0000-4000-8000-${String(orderSeq).padStart(12, "0")}`,
    devotee: { name },
    receipts: dates.map((offset, i) => ({
      clientReceiptId: `00000000-0000-4000-9000-${String(orderSeq * 100 + i).padStart(12, "0")}`,
      sevaDate: addDays(today, offset),
      qrToken: `TOKEN${String(orderSeq * 100 + i).padStart(17, "0")}`,
      lines: [{ sevaId: "seva-archana", quantity: 1 }],
    })),
    payment: { mode: "cash" },
    expectedTotalPaise: 5000 * dates.length,
  };
  const result = await api.handle({ method: "POST", path: "/api/seva/counter/orders", body, role });
  if (result.kind !== "json" || result.status !== 200) throw new Error(`fake refused the order: ${JSON.stringify(result)}`);
  const receipts = (result.body as IssueResponse).receipts;
  // The counter printed them when it saved.
  for (const r of receipts) {
    const kept = api.state.receipts.find((x) => x.clientReceiptId === r.clientReceiptId);
    if (kept) kept.printCount = 1;
  }
  return api.state.receipts.filter((x) => receipts.some((r) => r.clientReceiptId === x.clientReceiptId));
}

async function stubPrint(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __printed: number; print: () => void };
    w.__printed = 0;
    w.print = () => {
      w.__printed += 1;
    };
  });
}

async function printedCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __printed: number }).__printed);
}

/**
 * Puts local copies of receipts (as the counter keeps them after a save) and, optionally, counter credentials into
 * this PC's IndexedDB, with the same stores the app creates (lib/seva/offline/db.ts).
 */
async function seedPc(
  page: Page,
  opts: { receipts?: IssuedReceipt[]; device?: { deviceId: string; secret: string } },
): Promise<void> {
  const locals = (opts.receipts ?? []).map((r) => ({ ...r, businessDate: businessDate(new Date(r.issuedAt)), sent: true }));
  await page.evaluate(
    async ({ locals, device }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("seva-counter", 1);
        req.onupgradeneeded = () => {
          const d = req.result;
          d.createObjectStore("meta");
          d.createObjectStore("outbox", { keyPath: "seq" });
          d.createObjectStore("today", { keyPath: "clientReceiptId" }).createIndex("byDate", "businessDate");
          d.createObjectStore("catalogue");
          d.createObjectStore("profiles", { keyPath: "phoneHash" });
          d.createObjectStore("files");
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["meta", "today"], "readwrite");
        for (const r of locals) tx.objectStore("today").put(r);
        if (device) tx.objectStore("meta").put(device, "device");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { locals, device: opts.device ?? null },
  );
}

async function openToday(page: Page, api: FakeSevaApi, role: E2ERole): Promise<void> {
  await stubPrint(page);
  await api.install(page);
  await signInAs(page, role, { redirect: TODAY_PATH });
  await page.waitForURL((url) => url.pathname === TODAY_PATH, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: /Today's receipts/ })).toBeVisible({ timeout: 60_000 });
}

function card(page: Page, receiptNoOrGroup: string) {
  return page.getByRole("article", { name: receiptNoOrGroup });
}

test("reprint prints a DUPLICATE slip with the same number", async ({ page }) => {
  const api = createFakeSevaApi();
  const [receipt] = await issue(api, "receptionist", [0]);
  await openToday(page, api, "receptionist");

  const row = card(page, receipt.receiptNo);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Reprint" }).click();

  const root = page.locator("#seva-print-root");
  await expect(root).toContainText("DUPLICATE");
  await expect(root).toContainText("ನಕಲು");
  await expect(root).toContainText(receipt.receiptNo);
  await expect.poll(() => printedCount(page)).toBe(1);
  expect(api.requests.filter((r) => r.path === "/api/seva/counter/prints")).toHaveLength(1);
  expect(api.state.receipts.find((r) => r.receiptNo === receipt.receiptNo)?.printCount).toBe(2);
});

test("a cancelled receipt cannot be reprinted", async ({ page }) => {
  const api = createFakeSevaApi();
  const [receipt] = await issue(api, "receptionist", [0], "Prakash Bhat");
  const cancelled = await api.handle({
    method: "POST",
    path: "/api/seva/receipts/cancel",
    body: { receiptIds: [receipt.id], reasonCode: "wrong_seva" },
    role: "receptionist",
  });
  expect(cancelled.kind === "json" && cancelled.status).toBe(200);
  await openToday(page, api, "receptionist");

  const row = card(page, receipt.receiptNo);
  await expect(row).toContainText("Cancelled");
  await expect(row.getByRole("button", { name: "Reprint" })).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Spoiled - cancel and reissue" })).toHaveCount(0);
});

test("spoiled reissue prints a new number and marks the old one cancelled", async ({ page }) => {
  const api = createFakeSevaApi();
  const [old] = await issue(api, "receptionist", [0], "Shantha Kumari");
  await openToday(page, api, "temple_admin");

  await card(page, old.receiptNo).getByRole("button", { name: "Spoiled - cancel and reissue" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Spoiled print");
  await dialog.getByRole("button", { name: "Cancel and reissue" }).click();

  await expect.poll(() => printedCount(page)).toBe(1);
  const fresh = api.state.receipts.find((r) => r.receiptNo !== old.receiptNo && r.devotee.name === "Shantha Kumari");
  expect(fresh).toBeDefined();
  const root = page.locator("#seva-print-root");
  await expect(root).toContainText(fresh?.receiptNo ?? "missing");
  await expect(root).not.toContainText("DUPLICATE");
  await expect(card(page, old.receiptNo)).toContainText("Cancelled");
  await expect(card(page, fresh?.receiptNo ?? "missing")).toBeVisible();
  expect(api.state.receipts.find((r) => r.receiptNo === old.receiptNo)?.status).toBe("cancelled");
  // The first print of the new number is recorded after the slip went to the printer.
  await expect.poll(() => fresh?.printCount).toBe(1);
});

test("a group cancel can take one date only, from this PC with its device header", async ({ page }) => {
  const api = createFakeSevaApi();
  const group = await issue(api, "receptionist", [0, 1, 2], "Venkatesh Rao");
  await openToday(page, api, "receptionist");
  await seedPc(page, {
    receipts: group,
    device: { deviceId: "device-e2e-1", secret: "A".repeat(43) },
  });
  await page.reload();

  const groupCard = card(page, `Group ${group[0].groupNo}`);
  await expect(groupCard).toBeVisible({ timeout: 60_000 });
  await groupCard.getByRole("button", { name: "Cancel", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(/^All 3 receipts/)).toBeChecked();
  await dialog.getByLabel(new RegExp(`^Only ${group[1].receiptNo.split("/")[1]}`)).click();
  await expect(dialog).toContainText("Give back Rs 50 in cash");
  await dialog.getByLabel(/Reason/).selectOption("wrong_date");

  const sent = page.waitForRequest((r) => new URL(r.url()).pathname === "/api/seva/receipts/cancel");
  await dialog.getByRole("button", { name: "Cancel receipts" }).click();
  const request = await sent;
  expect(request.headers()["x-seva-device"]).toBe(`device-e2e-1.${"A".repeat(43)}`);

  await expect(page.getByText(/Receipt cancelled\. It stays in the register/)).toBeVisible();
  const states = group.map((g) => api.state.receipts.find((r) => r.receiptNo === g.receiptNo)?.status);
  expect(states).toEqual(["issued", "cancelled", "issued"]);
});

test("an offline cancel is queued and sent on reconnect", async ({ page, context }) => {
  const api = createFakeSevaApi();
  const [receipt] = await issue(api, "receptionist", [0], "Anand Kulkarni");
  await openToday(page, api, "receptionist");
  await seedPc(page, { receipts: [receipt] });
  await page.reload();
  await expect(card(page, receipt.receiptNo)).toBeVisible({ timeout: 60_000 });

  await context.setOffline(true);
  await expect(page.getByText(/Working offline/)).toBeVisible();
  const before = api.requests.length;

  const row = card(page, receipt.receiptNo);
  await row.getByRole("button", { name: "Cancel" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("The office checks this cancel");
  await dialog.getByLabel(/Reason/).selectOption("entered_twice");
  await dialog.getByRole("button", { name: "Cancel receipt" }).click();

  await expect(page.getByText("1 waiting to send to the office")).toBeVisible();
  await expect(row).toContainText("Cancelled");
  expect(api.requests.slice(before).filter((r) => r.path === "/api/seva/receipts/cancel")).toHaveLength(0);
  expect(api.state.receipts.find((r) => r.receiptNo === receipt.receiptNo)?.status).toBe("issued");

  await context.setOffline(false);
  await expect.poll(() => api.requests.filter((r) => r.path === "/api/seva/counter/sync").length, { timeout: 30_000 }).toBe(1);
  const sync = api.requests.find((r) => r.path === "/api/seva/counter/sync");
  const items = (sync?.body as { items: { kind: string; clientReceiptIds: string[]; cancelledByStaffNo: number }[] }).items;
  expect(items).toEqual([
    expect.objectContaining({ kind: "cancel", clientReceiptIds: [receipt.clientReceiptId], cancelledByStaffNo: 23 }),
  ]);
  await expect(page.getByText("1 waiting to send to the office")).toHaveCount(0);
  expect(api.state.receipts.find((r) => r.receiptNo === receipt.receiptNo)?.status).toBe("cancelled");
});
