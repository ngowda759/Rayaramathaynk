import { expect, test } from "@playwright/test";
import { businessDate } from "../../../lib/seva/time";
import type { DayCloseListRow } from "../../../lib/seva/server/reports";
import type { ContinuityRow } from "../../../types/seva-reports";
import type { ReceiptListItem } from "../../../types/seva-receipts";
import { signInAs } from "./fixtures/auth";
import { createFakeSevaApi, type FakeSevaApi } from "./fixtures/fake-api";
import { SEVA_ROUTES } from "../../../lib/seva/routes";

/**
 * Receipts register, reports and day closes (plan A4-7, DB §12.3-12.4). Every /api/seva/** call is answered by the
 * fake API; this file adds the register, continuity, audit and day-close answers in the real wire shapes.
 */

const TODAY = businessDate(new Date());
/** Plan A4P-3: a slow list answer, so the wait after a filter change can be watched. */
const SLOW_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function listItem(n: number, over: Partial<ReceiptListItem> = {}): ReceiptListItem {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    receiptNo: `C1-023-10-2026/${String(100 + n).padStart(6, "0")}`,
    series: "C1",
    businessDate: TODAY,
    issuedAt: new Date(Date.now() - n * 60_000).toISOString(),
    devoteeName: `Devotee ${n}`,
    sevas: "Paaduka Pooja",
    totalPaise: 50_500,
    mode: "cash",
    status: "issued",
    changed: false,
    printCount: 1,
    prasadam: "pending",
    groupNo: `G-2610-${String(n).padStart(4, "0")}`,
    position: 1,
    count: 1,
    issuedByStaffId: null,
    cancelDeadline: null,
    refundState: "none",
    ...over,
  };
}

function receiptRequests(fake: FakeSevaApi): URLSearchParams[] {
  return fake.requests
    .filter((r) => r.method === "GET" && r.path.split("?")[0] === "/api/seva/receipts")
    .map((r) => new URLSearchParams(r.path.split("?")[1] ?? ""));
}

test("filters map to the list query and the status filter from a link is applied", async ({ page }) => {
  const fake = createFakeSevaApi();
  fake.extend({ "GET receipts": () => ({ rows: [listItem(1, { changed: true })], nextCursor: null }) });
  await fake.install(page);
  await signInAs(page, "temple_admin", { redirect: `${SEVA_ROUTES.register}?status=changed` });

  await expect(page.getByLabel("Status")).toHaveValue("changed", { timeout: 60_000 });
  await expect.poll(() => receiptRequests(fake).some((q) => q.get("status") === "changed")).toBe(true);

  await page.getByLabel("Payment").selectOption("upi");
  await expect
    .poll(() => receiptRequests(fake).some((q) => q.get("status") === "changed" && q.get("mode") === "upi"))
    .toBe(true);

  await page.getByLabel("From").fill("2026-10-01");
  await page.getByLabel(/Search by number or name/).fill("Devotee");
  await expect
    .poll(() =>
      receiptRequests(fake).some((q) => q.get("from") === "2026-10-01" && q.get("q") === "Devotee" && q.get("mode") === "upi"),
    )
    .toBe(true);
});

test("a filter change keeps the rows with an inline pending line", async ({ page }) => {
  const fake = createFakeSevaApi();
  fake.extend({
    "GET receipts": async (req) => {
      const query = new URLSearchParams(req.path.split("?")[1] ?? "");
      if (query.get("mode") === "upi") {
        await sleep(SLOW_MS);
        return { rows: [listItem(2, { mode: "upi" })], nextCursor: null };
      }
      return { rows: [listItem(1)], nextCursor: null };
    },
  });
  await fake.install(page);
  await signInAs(page, "temple_admin", { redirect: SEVA_ROUTES.register });

  const first = page.getByRole("button", { name: /Open C1-023-10-2026\/000101/ }).first();
  await expect(first).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-register-pending="true"]')).toHaveCount(0);

  await page.getByLabel("Payment").selectOption("upi");
  // The old rows stay, with the pending line above them; never a blank list or a bare loading text.
  await expect(page.locator('[data-register-pending="true"]')).toBeVisible();
  await expect(page.getByTestId("register-list")).toHaveAttribute("aria-busy", "true");
  await expect(first).toBeVisible();
  await expect(page.getByText(/Loading receipts/)).toHaveCount(0);

  await expect(page.getByRole("button", { name: /Open C1-023-10-2026\/000102/ }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-register-pending="true"]')).toHaveCount(0);
  await expect(page.getByTestId("register-list")).not.toHaveAttribute("aria-busy", "true");
});

test("a row opens the receipt with its history", async ({ page }) => {
  const fake = createFakeSevaApi();
  const item = listItem(1);
  fake.extend({
    "GET receipts": () => ({ rows: [item], nextCursor: null }),
    "GET receipts/:id": () => ({
      id: item.id,
      clientReceiptId: "c-1",
      receiptNo: item.receiptNo,
      seriesCode: "C1",
      sevaDate: TODAY,
      groupNo: item.groupNo,
      position: 1,
      count: 1,
      orderTotalPaise: 50_500,
      totalPaise: 50_500,
      lines: [],
      payment: { mode: "cash" },
      devotee: { name: item.devoteeName },
      qrToken: "t",
      issuedAt: item.issuedAt,
      issuedBy: { name: "Ramesh", staffNo: 23 },
      counterName: "Counter 1",
      channel: "counter",
      issuedOffline: false,
      status: "issued",
      printCount: 1,
      prasadam: "pending",
      history: [{ at: item.issuedAt, action: "issued", by: "Ramesh", reason: null }],
      cancel: null,
      refundState: "none",
    }),
  });
  await fake.install(page);
  await signInAs(page, "temple_admin", { redirect: SEVA_ROUTES.register });

  await page.getByRole("button", { name: new RegExp(item.receiptNo.replace("/", "\\/")) }).first().click({ timeout: 60_000 });
  const drawer = page.getByRole("dialog");
  await expect(drawer).toContainText(item.receiptNo);
  await expect(drawer).toContainText("History");
  await expect(drawer.getByRole("link", { name: /Open the receipt/ })).toHaveAttribute("href", `/seva/${item.id}`);
});

test("a temple admin resolves a gap with a note", async ({ page }) => {
  const fake = createFakeSevaApi();
  const row: ContinuityRow = {
    series: "OF1",
    year: 2026,
    counterName: "Counter 1",
    firstNo: "OF1-023-10-2026/000001",
    lastNo: "OF1-023-10-2026/000009",
    numbers: 9,
    issued: 6,
    cancelled: 0,
    openGaps: 1,
    gaps: [{ id: 7, series: "OF1", year: 2026, fromNo: 7, toNo: 9, cause: "device_replaced", detectedAt: new Date().toISOString() }],
  };
  let resolved = false;
  fake.extend({
    "GET reports/continuity": () => (resolved ? [{ ...row, openGaps: 0, gaps: undefined, issued: 9 }] : [row]),
    "POST gaps/:id": () => {
      resolved = true;
      return { ok: true };
    },
  });
  await fake.install(page);
  await signInAs(page, "temple_admin", { redirect: SEVA_ROUTES.register });

  const of1 = page.getByTestId("continuity-OF1");
  await expect(of1).toContainText("1 open gap", { timeout: 60_000 });
  await of1.getByRole("button", { name: /Resolve/ }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Entered from the paper book/).check();
  const save = dialog.getByRole("button", { name: "Resolve gap" });
  await expect(save).toBeDisabled();
  await dialog.getByLabel(/Note/).fill("Copied from the paper receipt book page 12");
  await save.click();

  await expect(page.getByTestId("continuity-OF1")).toContainText("Continuous");
  const posted = fake.requests.filter((r) => r.method === "POST" && r.path === "/api/seva/gaps/7");
  expect(posted).toHaveLength(1);
  expect(posted[0].body).toEqual({ status: "entered_from_paper", note: "Copied from the paper receipt book page 12" });
});

test("a view-only temple admin sees the gap but no Resolve", async ({ page }) => {
  const fake = createFakeSevaApi();
  fake.extend({
    "GET reports/continuity": () => [
      {
        series: "OF1",
        year: 2026,
        counterName: "Counter 1",
        firstNo: null,
        lastNo: null,
        numbers: 0,
        issued: 0,
        cancelled: 0,
        openGaps: 1,
        gaps: [{ id: 7, series: "OF1", year: 2026, fromNo: 7, toNo: 9, cause: "device_replaced", detectedAt: new Date().toISOString() }],
      },
    ],
  });
  await fake.install(page);
  await signInAs(page, "temple_admin_view_only", { redirect: SEVA_ROUTES.register });
  await expect(page.getByTestId("continuity-OF1")).toContainText("1 open gap", { timeout: 60_000 });
  await expect(page.getByTestId("continuity-OF1").getByRole("button", { name: /Resolve/ })).toHaveCount(0);
});

test("rows become cards on a phone", async ({ page }) => {
  const fake = createFakeSevaApi();
  fake.extend({ "GET receipts": () => ({ rows: [listItem(1), listItem(2, { status: "cancelled" })], nextCursor: null }) });
  await fake.install(page);
  await signInAs(page, "temple_admin", { redirect: SEVA_ROUTES.register });
  await expect(page.getByTestId("register-table")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("register-cards")).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("register-cards")).toBeVisible();
  await expect(page.getByTestId("register-table")).toBeHidden();
  await expect(page.getByTestId("register-cards").getByRole("button")).toHaveCount(2);
  await expect(page.getByTestId("register-cards")).toContainText("Cancelled");
});

test("audit trail filters by type", async ({ page }) => {
  const fake = createFakeSevaApi();
  fake.extend({
    "GET reports/audit": (req) => {
      const type = new URLSearchParams(req.path.split("?")[1] ?? "").get("type");
      const cancel = {
        id: 11,
        at: new Date().toISOString(),
        action: "receipt.cancel",
        entity: "receipt",
        entityId: "00000000-0000-4000-8000-000000000011",
        receiptNo: "C1-023-10-2026/000144",
        reason: "Spoiled print: printer jammed.",
        by: { staffId: "00000000-0000-4000-8000-0000000000aa", name: "Ramesh", staffNo: 23 },
        before: null,
        after: null,
      };
      const rate = {
        id: 10,
        at: new Date().toISOString(),
        action: "seva.rate_change",
        entity: "seva",
        entityId: "00000000-0000-4000-8000-0000000000bb",
        receiptNo: null,
        reason: "Trust board decision.",
        by: { staffId: "00000000-0000-4000-8000-0000000000cc", name: "Srinivas Acharya", staffNo: 2 },
        before: { rate: "150.00" },
        after: { rate: "200.00" },
      };
      return { rows: type === "cancellations" ? [cancel] : [cancel, rate], nextCursor: null };
    },
  });
  await fake.install(page);
  await signInAs(page, "temple_admin", { redirect: SEVA_ROUTES.reportsAudit });

  await expect(page.getByTestId("audit-list")).toContainText("Trust board decision.", { timeout: 60_000 });
  await page.getByRole("radio", { name: /Cancellations/ }).click();
  await expect(page.getByTestId("audit-list")).not.toContainText("Trust board decision.");
  await expect(page.getByTestId("audit-list")).toContainText("C1-023-10-2026/000144");
  await expect(page.getByTestId("audit-list").getByRole("link", { name: /Open receipt/ })).toHaveAttribute(
    "href",
    "/seva/00000000-0000-4000-8000-000000000011",
  );
  const asked = fake.requests.filter((r) => r.method === "GET" && r.path.startsWith("/api/seva/reports/audit"));
  expect(asked.some((r) => r.path.includes("type=cancellations"))).toBe(true);
});

function dayClose(id: string, badge: DayCloseListRow["badge"], difference: number): DayCloseListRow {
  return {
    id,
    counterId: 1,
    counterName: "Counter 1",
    businessDate: TODAY,
    status: "closed",
    receipts: 120,
    cancelled: 2,
    changed: 1,
    cashExpectedPaise: 4_043_000,
    cashCountedPaise: 4_043_000 + difference,
    cashDifferencePaise: difference,
    upiCount: 30,
    upiExpectedPaise: 3_307_400,
    upiBankTotalPaise: 3_307_400,
    upiDifferencePaise: 0,
    badge,
    note: badge === "balanced" ? null : "Counted twice.",
    closedBy: "Ramesh",
    closedAt: new Date().toISOString(),
    reopenedBy: null,
    reopenedAt: null,
    reopenReason: null,
    counts: [{ kind: "note", valuePaise: 50_000, count: 80, amountPaise: 4_000_000 }],
  };
}

test("day closes show balanced, short and extra", async ({ page }) => {
  const fake = createFakeSevaApi();
  fake.extend({
    "GET reports/day-closes": () => [dayClose("d1", "balanced", 0), dayClose("d2", "short", -5_000), dayClose("d3", "extra", 2_000)],
  });
  await fake.install(page);
  await signInAs(page, "temple_admin", { redirect: SEVA_ROUTES.dayCloses });

  const list = page.getByTestId("day-close-list");
  await expect(list).toContainText("Balanced", { timeout: 60_000 });
  await expect(list).toContainText("Rs 50 short");
  await expect(list).toContainText("Rs 20 extra");
  await expect(page.getByTestId("day-close-summary")).toContainText("1 balanced, 1 short, 1 extra");

  await list.getByRole("button", { name: /Rs 50 short/ }).first().click();
  const detail = page.getByRole("dialog");
  await expect(detail).toContainText("Counted twice.");
  await expect(detail).toContainText("Rs 500 note");
});
