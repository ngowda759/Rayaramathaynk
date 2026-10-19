import { expect, type Locator, type Page } from "@playwright/test";
import type { CounterOrderPayload } from "../../../../types/seva";
import { signInAs, type E2ERole } from "./auth";
import type { FakeRequest, FakeSevaApi } from "./fake-api";

/**
 * Counter fixtures for the A4-1 browser tests (counter.spec.ts, counter-print.spec.ts, counter-offline.spec.ts).
 * The counter only issues receipts on a registered PC (Design Book 8.4), so tests store demo device credentials in the
 * page's own IndexedDB - the same record "Register this PC" leaves behind. The fake API does not check them.
 */

/** Demo credentials: a device id and a 43-character base64url secret, the shapes lib/seva/offline/device.ts accepts. */
export const E2E_DEVICE = { deviceId: "device-e2e-counter-1", secret: "e2e-counter-secret-0123456789abcdefABCDEF_-" };

type PrintCounter = Window & { __sevaPrints?: number };

/** Replaces window.print with a counter, so a test can see the print job without a print dialog. */
export async function stubPrint(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as PrintCounter;
    w.__sevaPrints = 0;
    window.print = () => {
      w.__sevaPrints = (w.__sevaPrints ?? 0) + 1;
    };
  });
}

export async function printCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as PrintCounter).__sevaPrints ?? 0);
}

/** Stores the counter credentials in this browser's IndexedDB (database 'seva-counter', version 1, store 'meta'). */
export async function registerThisPc(page: Page): Promise<void> {
  await page.evaluate(async (device) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("seva-counter", 1);
      open.onupgradeneeded = () => {
        // Same stores as lib/seva/offline/db.ts, for a browser that never opened the counter.
        const db = open.result;
        db.createObjectStore("meta");
        db.createObjectStore("outbox", { keyPath: "seq" });
        db.createObjectStore("today", { keyPath: "clientReceiptId" }).createIndex("byDate", "businessDate");
        db.createObjectStore("catalogue");
        db.createObjectStore("profiles", { keyPath: "phoneHash" });
        db.createObjectStore("files");
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("meta", "readwrite");
        tx.objectStore("meta").put(device, "device");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, E2E_DEVICE);
}

/** Signs in, registers this PC and opens the counter with the cursor in Name. */
export async function openCounter(page: Page, fake: FakeSevaApi, role: E2ERole = "receptionist"): Promise<void> {
  await fake.install(page);
  await stubPrint(page);
  await signInAs(page, role, { redirect: "/admin/receipts/counter" });
  await page.waitForURL((url) => url.pathname === "/admin/receipts/counter", { timeout: 60_000 });
  await registerThisPc(page);
  await page.reload();
  await expect(page.locator("#counter-name")).toBeFocused({ timeout: 60_000 });
}

/** Presses Tab until `target` has focus (keyboard only); fails after 40 presses. */
export async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let i = 0; i < 40; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("tabTo: the element never got focus");
}

/** The order POSTs the page sent. */
export function ordersPosted(fake: FakeSevaApi): FakeRequest[] {
  return fake.requests.filter((r) => r.method === "POST" && r.path.startsWith("/api/seva/counter/orders"));
}

export function orderBody(request: FakeRequest): CounterOrderPayload {
  return request.body as CounterOrderPayload;
}

/** Name, then Alt+2, then the seva with this tile number, then Alt+3 (cash). Keyboard only. */
export async function quickOrder(page: Page, name: string, key: number): Promise<void> {
  await page.locator("#counter-name").focus();
  await page.keyboard.type(name);
  await page.keyboard.press("Alt+2");
  await expect(page.locator("#counter-seva-search")).toBeFocused();
  await page.keyboard.type(String(key));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("list", { name: "On this receipt" }).getByRole("listitem")).toHaveCount(1);
  await page.keyboard.press("Alt+3");
  await expect(page.getByRole("button", { name: /Save and print/ })).toBeEnabled();
}

/**
 * The Design Book's multi-date case by keyboard only: a name, Enter through the fields to step 2, tile 3 (Paaduka
 * Pooja, multi-date) for today and the next two days, then pay and print.
 */
export async function threeDateOrder(page: Page, name = "Venkatesh Rao"): Promise<void> {
  await page.keyboard.type(name);
  for (let i = 0; i < 5; i += 1) await page.keyboard.press("Enter");
  await expect(page.locator("#counter-seva-search")).toBeFocused();
  await page.keyboard.type("3");
  await page.keyboard.press("Enter");
  const dates = page.getByRole("button", { name: "Dates for Paaduka Pooja" });
  await expect(dates).toBeVisible();
  await tabTo(page, dates);
  await page.keyboard.press("Enter");
  for (let i = 0; i < 2; i += 1) {
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
  }
  await page.keyboard.press("Escape");
  await expect(page.getByText(/^3 receipts: /)).toBeVisible();
  await page.keyboard.press("Alt+3");
  await page.keyboard.press("Control+Enter");
}
