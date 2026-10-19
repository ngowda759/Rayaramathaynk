import { expect, test } from "@playwright/test";
import { createFakeSevaApi } from "./fixtures/fake-api";
import { signInAs } from "./fixtures/auth";
import {
  orderBody,
  ordersPosted,
  openCounter,
  printCount,
  quickOrder,
  stubPrint,
  tabTo,
  threeDateOrder,
} from "./fixtures/counter";
import { SEVA_ROUTES } from "../../../lib/seva/routes";

/**
 * The counter screens (plan A4-1, Design Book 9): keyboard flow, save and print, UPI, a catalogue change under the
 * order and a PC that is not registered. Every /api/seva/** call is answered by the fake API.
 * Plan A4P-2: the steps slide and the save answers at once, so the keyboard flow must still work under motion.
 */

const SLOW_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

declare global {
  interface Window {
    __sevaSave?: { clickAt: number | null; savingAt: number | null; printedAt: number | null };
  }
}

test("the keyboard-only 3-date receipt still works", async ({ page }) => {
  const fake = createFakeSevaApi();
  await openCounter(page, fake);

  await threeDateOrder(page);

  const numbers = page.getByTestId("printed-receipt-no");
  await expect(numbers).toHaveCount(3);
  for (let i = 0; i < 3; i += 1) await expect(numbers.nth(i)).toContainText(/^C1-023-\d{2}-\d{4}\/\d{6}$/);
  const orders = ordersPosted(fake);
  expect(orders).toHaveLength(1);
  expect(orderBody(orders[0]).receipts).toHaveLength(3);
  expect(await printCount(page)).toBe(1);
  await expect(page.locator("#counter-name")).toBeFocused();
  await expect(page.locator("#counter-name")).toHaveValue("");
});

test("saving shows Saving... within 150 ms and the printed panel after", async ({ page }) => {
  const crashes: string[] = [];
  page.on("pageerror", (err) => crashes.push(err.message));
  const fake = createFakeSevaApi();
  await openCounter(page, fake);
  // The office takes 800 ms to answer the order; the fake answers it after that (registered last, so it runs first).
  await page.route("**/api/seva/counter/orders", async (route) => {
    await sleep(SLOW_MS);
    await route.fallback();
  });
  await quickOrder(page, "Lakshmi Devi", 1);

  // Note, inside the page, when the click lands, when "Saving" shows and when the printed panel appears.
  await page.evaluate(() => {
    const seen = { clickAt: null as number | null, savingAt: null as number | null, printedAt: null as number | null };
    window.__sevaSave = seen;
    const check = () => {
      if (seen.clickAt === null) return;
      const now = performance.now();
      const busy = document.querySelector('button[aria-busy="true"]');
      if (seen.savingAt === null && busy && /Saving/.test(busy.textContent ?? "")) seen.savingAt = now;
      if (seen.printedAt === null && document.querySelector('[data-testid="printed-receipt-no"]')) seen.printedAt = now;
    };
    document.addEventListener(
      "click",
      () => {
        if (seen.clickAt === null) seen.clickAt = performance.now();
        queueMicrotask(check);
      },
      { capture: true },
    );
    new MutationObserver(check).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  });

  await page.getByRole("button", { name: /Save and print 1 receipt/ }).click();
  await expect(page.getByRole("button", { name: /Saving/ })).toBeVisible();
  await expect(page.getByTestId("printed-receipt-no")).toHaveCount(0);

  await expect(page.getByTestId("printed-receipt-no")).toHaveCount(1, { timeout: 10_000 });
  const seen = await page.evaluate(() => window.__sevaSave);
  expect(seen?.clickAt).not.toBeNull();
  expect(seen?.savingAt).not.toBeNull();
  expect((seen?.savingAt ?? Infinity) - (seen?.clickAt ?? 0)).toBeLessThan(150);
  // The printed panel waits for the office's answer.
  expect((seen?.printedAt ?? 0) - (seen?.clickAt ?? 0)).toBeGreaterThanOrEqual(SLOW_MS - 50);
  expect(ordersPosted(fake)).toHaveLength(1);
  expect(await printCount(page)).toBe(1);
  await expect(page.locator("#counter-name")).toBeFocused();
  expect(crashes).toEqual([]);
});

test("Ctrl+Enter twice posts once", async ({ page }) => {
  const fake = createFakeSevaApi();
  await openCounter(page, fake);
  await quickOrder(page, "Lakshmi Devi", 1);

  await page.keyboard.press("Control+Enter");
  await page.keyboard.press("Control+Enter");

  await expect(page.getByTestId("printed-receipt-no")).toHaveCount(1);
  await page.waitForTimeout(1000);
  expect(ordersPosted(fake)).toHaveLength(1);
  expect(await printCount(page)).toBe(1);
});

test("number keys and codes add sevas", async ({ page }) => {
  const fake = createFakeSevaApi();
  await openCounter(page, fake);
  await page.keyboard.type("Ramaiah");
  await page.keyboard.press("Alt+2");
  await expect(page.locator("#counter-seva-search")).toBeFocused();

  // A letter code and Enter in the search box.
  await page.keyboard.type("PA");
  await page.keyboard.press("Enter");
  const lines = page.getByRole("list", { name: "On this receipt" });
  await expect(lines).toContainText("Panchamrutha Abhisheka");

  // A tile number while focus is on the tile grid.
  await tabTo(page, page.locator('[data-seva-key="1"]'));
  await page.keyboard.press("4");
  await expect(lines).toContainText("Sarva Seva");
  await expect(lines.getByRole("listitem")).toHaveCount(2);

  // A typed number and Enter; an empty search with Enter goes on to step 3.
  await page.locator("#counter-seva-search").focus();
  await page.keyboard.type("1");
  await page.keyboard.press("Enter");
  await expect(lines.getByRole("listitem")).toHaveCount(3);
  await page.keyboard.press("Enter");
  await expect(page.locator("#counter-cash-received")).toBeFocused();
});

test("UPI needs six digits and the tick before Save enables", async ({ page }) => {
  const fake = createFakeSevaApi();
  await openCounter(page, fake);
  await quickOrder(page, "Venkatesh Rao", 1);

  await page.getByRole("radio", { name: /UPI/ }).click();
  const save = page.getByRole("button", { name: /Save and print/ });
  const ref = page.getByLabel(/last 6 digits/);
  await expect(save).toBeDisabled();
  await ref.fill("1190");
  await expect(save).toBeDisabled();
  await ref.fill("119042");
  await expect(save).toBeDisabled();
  await page.getByRole("checkbox", { name: /I saw the payment succeed/ }).check();
  await expect(save).toBeEnabled();

  await save.click();
  await expect(page.getByTestId("printed-receipt-no")).toHaveCount(1);
  const [order] = ordersPosted(fake);
  expect(orderBody(order).payment).toEqual({ mode: "upi", upiRefLast6: "119042", upiSeenConfirmed: true });
});

test("price change reloads the catalogue and prints nothing", async ({ page }) => {
  const fake = createFakeSevaApi();
  await openCounter(page, fake);
  await quickOrder(page, "Venkatesh Rao", 2);
  const bootstraps = () => fake.requests.filter((r) => r.method === "GET" && r.path.startsWith("/api/seva/counter/bootstrap")).length;
  const before = bootstraps();

  fake.failNext("/api/seva/counter/orders", { status: 409, code: "price_changed" });
  await page.keyboard.press("Control+Enter");

  await expect(page.getByRole("alert").filter({ hasText: "The seva list was reloaded" })).toBeVisible();
  await expect.poll(bootstraps).toBeGreaterThan(before);
  expect(await printCount(page)).toBe(0);
  await expect(page.getByTestId("printed-receipt-no")).toHaveCount(0);
  // The order is kept as typed.
  await expect(page.getByRole("complementary").getByText("Venkatesh Rao")).toBeVisible();
  await expect(page.getByRole("complementary").getByText("Panchamrutha Abhisheka")).toBeVisible();
  await expect(page.getByRole("button", { name: /Save and print 1 receipt/ })).toBeEnabled();
});

test("Kannada name prints on the slip", async ({ page }) => {
  const fake = createFakeSevaApi();
  await openCounter(page, fake);
  await quickOrder(page, "ವೆಂಕಟೇಶ", 1);
  await page.keyboard.press("Control+Enter");

  await expect(page.getByTestId("printed-receipt-no")).toHaveCount(1);
  await expect(page.locator("#seva-print-root")).toContainText("ವೆಂಕಟೇಶ");
  const [order] = ordersPosted(fake);
  expect(orderBody(order).devotee.name).toBe("ವೆಂಕಟೇಶ");
});

test("an unregistered PC shows the register prompt", async ({ page }) => {
  const fake = createFakeSevaApi();
  await fake.install(page);
  await stubPrint(page);
  await signInAs(page, "receptionist", { redirect: SEVA_ROUTES.counter });

  await expect(page.getByText("This PC is not a registered counter")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Ask a temple admin to register this PC.")).toBeVisible();
  await expect(page.locator("#counter-name")).toHaveCount(0);
});
