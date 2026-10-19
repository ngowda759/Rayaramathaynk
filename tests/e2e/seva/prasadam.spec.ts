import { expect, test, type Page } from "@playwright/test";
import type { IssuedReceipt } from "../../../types/seva";
import { formatReceiptNo } from "../../../lib/seva/numbering";
import { newQrToken } from "../../../lib/seva/qr";
import { addDays, businessDate, istParts } from "../../../lib/seva/time";
import { signInAs } from "./fixtures/auth";
import { E2E_SITE_URL } from "./fixtures/data";
import { createFakeSevaApi, fakeResponse, type FakeHandler, type FakeSevaApi } from "./fixtures/fake-api";
import { SEVA_ROUTES } from "../../../lib/seva/routes";

/**
 * Prasadam counter (plan Task A4-5, DB §11) on a phone (the `phone` project) and a PC. Every /api/seva/** call is
 * answered by the fake API. The prasadam routes go to a second fake that shares the receipts, so the give answer can
 * carry `givenNow` the way the real route does (A3-FIX): the caller's own give -> "Marked given" with Undo; an
 * `already_given` without it -> someone else gave it.
 */

let seq = 0;

function receipt(opts: { series?: string; running: number; sevaDate?: string; name?: string; prasadam?: IssuedReceipt["prasadam"] }): IssuedReceipt {
  const now = istParts(new Date());
  const receiptNo = formatReceiptNo({ series: opts.series ?? "C1", staffNo: 23, channel: null, month: now.month, year: now.year, running: opts.running });
  const id = `rcpt-e2e-${++seq}`;
  return {
    id,
    clientReceiptId: `client-${id}`,
    receiptNo,
    seriesCode: opts.series ?? "C1",
    sevaDate: opts.sevaDate ?? businessDate(new Date()),
    groupNo: `G-E2E-${seq}`,
    position: 1,
    count: 1,
    orderTotalPaise: 5000,
    totalPaise: 5000,
    lines: [
      {
        lineNo: 1,
        sevaId: "seva-archana",
        code: "AR",
        nameEn: "Archana",
        nameKn: "ಅರ್ಚನೆ",
        quantity: 1,
        unitRatePaise: 5000,
        amountPaise: 5000,
        changed: false,
        prasadamItems: "Kumkum, flowers",
      },
    ],
    payment: { mode: "cash" },
    devotee: { name: opts.name ?? "Venkatesh Rao" },
    qrToken: newQrToken(),
    issuedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    issuedBy: { name: "Lakshmi R", staffNo: 23 },
    counterName: "Counter 1",
    channel: "counter",
    issuedOffline: false,
    status: "issued",
    printCount: 1,
    prasadam: opts.prasadam ?? "pending",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The page's fake, with the prasadam routes answered by `core` (same receipts) and `givenNow` on an own give.
 * `slowMs` holds every give and undo answer back that long (plan A4P-4: the pending state shows meanwhile).
 */
function prasadamFake(receipts: IssuedReceipt[], opts: { slowMs?: number } = {}): { api: FakeSevaApi; core: FakeSevaApi } {
  const core = createFakeSevaApi({ receipts });
  const api = createFakeSevaApi({ receipts });
  const forward =
    (method: "GET" | "POST"): FakeHandler =>
    async (req) => {
      if (method === "POST" && opts.slowMs) await sleep(opts.slowMs);
      const body = req.body as { receiptId?: unknown } | null;
      const target = method === "POST" && body && typeof body.receiptId === "string" ? receipts.find((r) => r.id === body.receiptId) : undefined;
      const givenBefore = target?.prasadam === "given";
      const res = await core.handle({ method, path: req.path, body: req.body, role: "prasadam_counter" });
      if (res.kind !== "json") throw new Error("the prasadam core fake does not abort");
      const answer = res.body as Record<string, unknown>;
      const ownGive = req.path.includes("/prasadam/give") && answer.state === "already_given" && !givenBefore;
      return fakeResponse(res.status, ownGive ? { ...answer, givenNow: true } : answer);
    };
  api.extend({ "GET prasadam/lookup": forward("GET"), "POST prasadam/give": forward("POST"), "POST prasadam/undo": forward("POST") });
  return { api, core };
}

async function openCounter(page: Page, api: FakeSevaApi, path: string = SEVA_ROUTES.prasadam): Promise<void> {
  await api.install(page);
  await signInAs(page, "prasadam_counter", { redirect: SEVA_ROUTES.prasadam });
  if (path !== SEVA_ROUTES.prasadam) await page.goto(path);
  await expect(page.getByRole("heading", { name: /Prasadam counter/ })).toBeVisible({ timeout: 60_000 });
}

async function typeNumber(page: Page, text: string): Promise<void> {
  const radio = page.getByRole("radio", { name: /Type receipt number/ });
  if ((await radio.getAttribute("aria-checked")) !== "true") await radio.click();
  const box = page.getByLabel(/Receipt number, as printed/);
  await box.fill(text);
  await box.press("Enter");
}

const resultCard = (page: Page, state: string) => page.locator(`[data-testid="prasadam-result"][data-state="${state}"]`);
const calls = (api: FakeSevaApi, route: string) => api.requests.filter((r) => r.path.startsWith(`/api/seva/${route}`));

test("typed number -> ready -> Mark given -> Undo within the time", async ({ page }) => {
  const r = receipt({ running: 124 });
  const { api } = prasadamFake([r]);
  await openCounter(page, api);

  await typeNumber(page, r.receiptNo);
  const ready = resultCard(page, "ready");
  await expect(ready).toBeVisible();
  await expect(ready).toContainText("Venkatesh Rao");
  await expect(ready).toContainText("Archana × 1");
  await expect(ready).toContainText("Kumkum, flowers");
  await expect(ready).not.toContainText(/Rs\.?\s?\d/);

  await ready.getByRole("button", { name: /Mark given/ }).click();
  const marked = resultCard(page, "marked");
  await expect(marked).toContainText("Marked given");
  await expect(marked).toContainText(r.receiptNo);
  await expect(page.getByTestId("prasadam-given-today")).toContainText("Given 1");
  await expect(page.getByLabel(/Receipt number, as printed/)).toBeFocused();

  await marked.getByRole("button", { name: /Undo/ }).click();
  await expect(resultCard(page, "ready")).toBeVisible();
  await expect(resultCard(page, "marked")).toHaveCount(0);
  await expect(page.getByTestId("prasadam-given-today")).toContainText("Given 0");
  expect(calls(api, "prasadam/undo")).toHaveLength(1);
  expect(r.prasadam).toBe("pending");
});

test("a slow give shows Marking given... at once, then the tick, and a slow Undo shows Undoing...", async ({ page }) => {
  const r = receipt({ running: 132 });
  const { api } = prasadamFake([r], { slowMs: 800 });
  await openCounter(page, api);

  await typeNumber(page, r.receiptNo);
  const ready = resultCard(page, "ready");
  const give = ready.getByRole("button", { name: /Mark given/ });
  await give.click();
  // The tapped button answers at once (well before the 800 ms answer); the others wait.
  const working = ready.locator('button[aria-busy="true"]');
  await expect(working).toContainText("Marking given...", { timeout: 600 });
  await expect(working).toBeDisabled();
  await expect(ready.getByRole("button", { name: /Not now/ })).toBeDisabled();

  const marked = resultCard(page, "marked");
  await expect(marked).toContainText("Marked given");
  await expect(marked.locator("[data-tick]")).toBeVisible();
  expect(calls(api, "prasadam/give")).toHaveLength(1);

  await marked.getByRole("button", { name: /Undo/ }).click();
  await expect(marked.locator('button[aria-busy="true"]')).toContainText("Undoing...", { timeout: 600 });
  await expect(resultCard(page, "ready")).toBeVisible();
  expect(calls(api, "prasadam/undo")).toHaveLength(1);
});

test("a second lookup says already given, by whom and when", async ({ page }) => {
  const r = receipt({ running: 125 });
  const { api } = prasadamFake([r]);
  await openCounter(page, api);

  await typeNumber(page, r.receiptNo);
  await resultCard(page, "ready").getByRole("button", { name: /Mark given/ }).click();
  await expect(resultCard(page, "marked")).toBeVisible();

  await typeNumber(page, r.receiptNo);
  const given = resultCard(page, "already_given");
  await expect(given).toContainText("Already given");
  await expect(given).toContainText(/Given (on .+ )?at \d{1,2}:\d{2} [AP]M by Govinda P\./);
  await expect(given).toContainText("Do not give again. If the devotee disagrees, ask the receptionist.");
  await expect(given.getByRole("button", { name: /Undo/ })).toHaveCount(0);
});

test("someone else's give in between shows who gave it, with no Undo", async ({ page }) => {
  const r = receipt({ running: 126 });
  const { api, core } = prasadamFake([r]);
  await openCounter(page, api);

  await typeNumber(page, r.receiptNo);
  await expect(resultCard(page, "ready")).toBeVisible();
  // A temple admin marks it on another phone before this volunteer taps.
  const other = await core.handle({ method: "POST", path: "/api/seva/prasadam/give", body: { receiptId: r.id, confirmOffDate: false }, role: "temple_admin" });
  expect(other.kind).toBe("json");

  await resultCard(page, "ready").getByRole("button", { name: /Mark given/ }).click();
  const given = resultCard(page, "already_given");
  await expect(given).toContainText("by Srinivas T.");
  await expect(given.getByRole("button", { name: /Undo/ })).toHaveCount(0);
  await expect(resultCard(page, "marked")).toHaveCount(0);
  await expect(page.getByTestId("prasadam-given-today")).toContainText("Given 0");
});

test("a slip for another day needs Give anyway", async ({ page }) => {
  const r = receipt({ running: 127, sevaDate: addDays(businessDate(new Date()), 1) });
  const { api } = prasadamFake([r]);
  await openCounter(page, api);

  await typeNumber(page, r.receiptNo);
  const card = resultCard(page, "another_day");
  await expect(card).toContainText("Not today");
  await expect(card).toContainText("This prasadam is for");

  await card.getByRole("button", { name: /Give anyway/ }).click();
  expect(calls(api, "prasadam/give")).toHaveLength(0);
  await card.getByRole("button", { name: /Tap again to give/ }).click();
  await expect(resultCard(page, "marked")).toContainText("Marked given");
  const gives = calls(api, "prasadam/give");
  expect(gives).toHaveLength(1);
  expect(gives[0].body).toEqual({ receiptId: r.id, confirmOffDate: true });
});

test("scanner-typed URL in the number box finds the receipt", async ({ page }) => {
  const r = receipt({ running: 128, name: "Sudha Rao" });
  const { api } = prasadamFake([r]);
  await openCounter(page, api);

  await typeNumber(page, `${E2E_SITE_URL}/r/${r.qrToken}`);
  await expect(resultCard(page, "ready")).toContainText("Sudha Rao");
});

test("the token from the public receipt page looks the receipt up at once", async ({ page }) => {
  const r = receipt({ running: 129, name: "Prakash Bhat" });
  const { api } = prasadamFake([r]);
  await openCounter(page, api, `${SEVA_ROUTES.prasadam}?token=${r.qrToken}`);
  await expect(resultCard(page, "ready")).toContainText("Prakash Bhat");
});

test("an ambiguous short number shows a pick list", async ({ page }) => {
  const one = receipt({ series: "C1", running: 130, name: "Venkatesh Rao" });
  const two = receipt({ series: "C2", running: 130, name: "Sudha Rao" });
  const { api } = prasadamFake([one, two]);
  await openCounter(page, api);

  await typeNumber(page, "130");
  const choose = resultCard(page, "choose");
  await expect(choose).toContainText("Which receipt?");
  await expect(choose.getByRole("button")).toHaveCount(2);
  await choose.getByRole("button", { name: new RegExp(two.receiptNo.replace(/[/-]/g, "\\$&")) }).click();
  const ready = resultCard(page, "ready");
  await expect(ready).toContainText("Sudha Rao");
  await expect(ready).toContainText(two.receiptNo);
});

test("offline shows the check-by-eye message", async ({ page, context }) => {
  const r = receipt({ running: 131 });
  const { api } = prasadamFake([r]);
  await openCounter(page, api);
  const message = "No connection. Check the date on the slip by eye and mark it later.";

  api.failNext("prasadam/lookup", "network");
  await typeNumber(page, r.receiptNo);
  await expect(page.getByTestId("prasadam-offline")).toContainText(message);

  await typeNumber(page, r.receiptNo);
  await expect(resultCard(page, "ready")).toBeVisible();
  await expect(page.getByTestId("prasadam-offline")).toHaveCount(0);

  await context.setOffline(true);
  await expect(page.getByTestId("prasadam-offline")).toContainText(message);
  await context.setOffline(false);
  await expect(page.getByTestId("prasadam-offline")).toHaveCount(0);
});

test("phone: a prasadam volunteer sees only the header with Sign out and the scan screen", async ({ page }) => {
  test.skip(!test.info().project.name.startsWith("phone"), "phone frame only");
  const { api } = prasadamFake([receipt({ running: 140 })]);
  await openCounter(page, api);

  const header = page.locator("header[data-seva-header]");
  await expect(header).toBeVisible();
  await expect(header.getByRole("button", { name: /Sign out/ })).toBeVisible();
  await expect(header.getByRole("link", { name: /Website admin/ })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Seva Entry sections" })).toHaveCount(0);
  await expect(page.locator("[data-seva-phonebar]")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /Type receipt number/ })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/seva/prasadam");
});
