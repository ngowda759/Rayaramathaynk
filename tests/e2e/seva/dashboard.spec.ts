import { expect, test, type Page } from "@playwright/test";
import type { Period } from "../../../lib/seva/time";
import type { DashboardData, NeedsAttentionCard } from "../../../types/seva-reports";
import { signInAs } from "./fixtures/auth";
import { createFakeSevaApi, type FakeSevaApi } from "./fixtures/fake-api";

/**
 * Seva dashboard (plan Task A4-6, DB §12.1-12.2) on a PC (1366 px, `desktop`) and a phone (390 px, `phone`). The
 * dashboard route is answered per period by this file's own fixture; every other /api/seva/** call by the fake API.
 */

const TOTALS: Record<Period, { total: number; receipts: number; cash: number; upi: number }> = {
  today: { total: 6_119_600, receipts: 125, cash: 3_467_100, upi: 2_652_500 },
  week: { total: 38_412_000, receipts: 811, cash: 20_100_000, upi: 18_312_000 },
  month: { total: 121_005_000, receipts: 2_410, cash: 70_000_000, upi: 51_005_000 },
  year: { total: 980_000_000, receipts: 19_204, cash: 560_000_000, upi: 420_000_000 },
};

const YEAR = new Date().getFullYear();
const YEAR_DAYS = [
  { date: `${YEAR}-01-14`, totalPaise: 9_000_000 },
  { date: `${YEAR}-03-08`, totalPaise: 4_500_000 },
  { date: `${YEAR}-08-15`, totalPaise: 7_200_000 },
  { date: `${YEAR}-10-18`, totalPaise: 6_119_600 },
];
const YEAR_FESTIVALS = [`${YEAR}-01-14`, `${YEAR}-08-15`];

function answerFor(period: Period): { data: DashboardData; attention: NeedsAttentionCard[] } {
  const t = TOTALS[period];
  const labels = period === "today" ? ["05:00", "06:00", "07:00", "08:00"] : period === "year" ? ["Jan", "Feb", "Mar"] : ["Mon", "Tue", "Wed"];
  const share = Math.floor(t.cash / labels.length);
  const upiShare = Math.floor(t.upi / labels.length);
  return {
    data: {
      period,
      asOf: new Date().toISOString(),
      tiles: {
        totalPaise: t.total,
        receipts: t.receipts,
        cashPaise: t.cash,
        upiPaise: t.upi,
        onlinePaise: 0,
        prev: { totalPaise: Math.round(t.total / 1.12), receipts: t.receipts + 5, cashPaise: t.cash, upiPaise: t.upi, onlinePaise: 0 },
      },
      hero: {
        buckets: labels.map((label, i) => ({ key: String(i), label, cashPaise: share, upiPaise: upiShare, onlinePaise: 0 })),
        prev: labels.map((_, i) => ({ key: String(i), totalPaise: share })),
      },
      topSevas: [
        { sevaId: "s1", nameEn: "Archana", nameKn: "ಅರ್ಚನೆ", amountPaise: 1_000_000, quantity: 200, prevAmountPaise: 900_000 },
        { sevaId: "s2", nameEn: "Paaduka Pooja", nameKn: null, amountPaise: 505_000, quantity: 10, prevAmountPaise: 600_000 },
      ],
      mode: { cashPaise: t.cash, upiPaise: t.upi, onlinePaise: 0 },
      rush: [
        { dow: 1, hour: 9, count: 12 },
        { dow: 7, hour: 18, count: 30 },
      ],
      // Only This year's answer holds the days before this period; Festival peaks must ask for it on the other periods.
      calendar: period === "year" ? YEAR_DAYS : [{ date: `${YEAR}-10-18`, totalPaise: t.total }],
      festivalDates: period === "year" ? YEAR_FESTIVALS : [`${YEAR}-10-18`],
    },
    attention: [
      { id: "changed_amounts", level: "attention", count: 2, detail: {} },
      { id: "cancellations", level: "ok", count: 0, detail: {} },
      { id: "day_close_difference", level: "critical", count: 1, detail: { short: 1, extra: 0 } },
      { id: "waiting_to_sync", level: "ok", count: 0, detail: { outbox: 0 } },
      { id: "prasadam_pending", level: "attention", count: 9, detail: { today: 9, past: 0, oldest_today: "14:10" } },
      { id: "database_size", level: "ok", count: 0, detail: { mb: 20 } },
    ],
  };
}

function dashboardFake(): FakeSevaApi {
  const api = createFakeSevaApi();
  api.extend({
    "GET reports/dashboard": (req) => {
      const period = new URL(req.path, "http://localhost").searchParams.get("period") as Period | null;
      return answerFor(period ?? "today");
    },
  });
  return api;
}

/** Plan A4P-3: a slow answer, so the wait between the click and the new numbers can be watched. */
const SLOW_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

declare global {
  interface Window {
    __dashboardWatch?: { clickAt: number | null; pendingAt: number | null; blank: boolean };
  }
}

const dashboardCalls = (api: FakeSevaApi) => api.requests.filter((r) => r.path.startsWith("/api/seva/reports/dashboard"));

async function openDashboard(page: Page, api: FakeSevaApi): Promise<void> {
  await api.install(page);
  await signInAs(page, "temple_admin", { redirect: "/admin/receipts" });
  await expect(page.getByRole("heading", { level: 1, name: /Dashboard/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("tile-total")).toBeVisible();
  // The charts are loaded on demand, and each chart's title comes with it. Festival peaks keeps a plain heading until
  // its calendar is asked for, so wait for the four charts every period draws, not for that heading.
  await expect(page.locator(".seva figure h3")).toHaveCount(4);
  await expect(page.locator('[data-section="rush-hours"] figure h3')).toBeVisible();
}

/** Top edge of each landmark in page order: the period switch, Needs attention, tiles, hero, details. */
async function sectionTops(page: Page): Promise<number[]> {
  const targets = [
    page.getByRole("radiogroup", { name: "Period shown" }),
    page.locator("#attn-h"),
    page.getByTestId("tile-total"),
    page.locator('[data-section="collections"]'),
    page.locator('[data-section="top-sevas"]'),
    page.locator('[data-section="payment-mode"]'),
    page.locator('[data-section="rush-hours"]'),
    page.locator('[data-section="festival-peaks"]'),
  ];
  const tops: number[] = [];
  for (const t of targets) {
    const box = await t.boundingBox();
    expect(box).not.toBeNull();
    tops.push(Math.round((box?.y ?? 0) + (await page.evaluate(() => window.scrollY))));
  }
  return tops;
}

test("the period switch comes first and drives every number", async ({ page }) => {
  const api = dashboardFake();
  await openDashboard(page, api);

  const tops = await sectionTops(page);
  expect(tops[0]).toBeLessThan(tops[1]);
  await expect(page.getByTestId("tile-total")).toContainText("Rs 61,196");
  await expect(page.getByTestId("tile-total")).toContainText("+12%");
  expect(dashboardCalls(api).at(-1)?.path).toContain("period=today");

  await page.getByRole("radio", { name: /week/i }).click();
  await expect(page.getByTestId("tile-total")).toContainText("Rs 3,84,120");
  await expect(page.getByTestId("tile-receipts")).toContainText("811");
  await expect(page.getByTestId("tile-total")).toContainText("vs last week");
  expect(dashboardCalls(api).some((r) => r.path.includes("period=week"))).toBe(true);
  await expect(page).toHaveURL(/period=week/);

  await page.getByRole("radio", { name: /year/i }).click();
  await expect(page.getByTestId("tile-total")).toContainText("Rs 98,00,000");
  // This year puts Festival peaks on the first screen, above the other details.
  const yearTops = await sectionTops(page);
  expect(yearTops[7]).toBeLessThan(yearTops[4]);
});

test("desktop and phone show the same order", async ({ page }) => {
  const api = dashboardFake();
  await openDashboard(page, api);

  const headings = (await page.locator(".seva h1, .seva h2, .seva h3").allInnerTexts())
    .map((t) => t.split("\n")[0].trim())
    .filter((t, i, all) => t !== "" && all.indexOf(t) === i);
  expect(headings).toEqual([
    "Dashboard",
    "Needs attention",
    "Charts for the period",
    "Collections",
    "Top sevas",
    "Payment mode",
    "Counter rush hours",
    "Festival peaks",
  ]);

  const tops = await sectionTops(page);
  for (let i = 1; i < tops.length; i += 1) expect(tops[i]).toBeGreaterThanOrEqual(tops[i - 1]);

  // Needs attention: critical first, each linking to its filtered screen.
  const cards = page.locator('[data-testid^="attention-"][data-level]');
  await expect(cards.first()).toHaveAttribute("data-testid", "attention-day_close_difference");
  await expect(page.getByTestId("attention-changed_amounts").getByRole("link")).toHaveAttribute("href", "/admin/receipts/register?status=changed");
  await expect(page.getByTestId("attention-prasadam_pending")).toContainText("9 prasadam pending today");
  await expect(page.getByTestId("attention-database_size")).toHaveCount(0);
});

test("each chart has a hidden data table", async ({ page }) => {
  const api = dashboardFake();
  await openDashboard(page, api);
  expect(dashboardCalls(api).some((r) => r.path.includes("period=year"))).toBe(false);
  await page.getByRole("button", { name: /Show the \d{4} calendar/ }).click();
  await expect(page.locator('[data-section="festival-peaks"] figure')).toBeVisible();
  // Today's answer has one day; the calendar shows every day of the year, so the tap asked for the year answer.
  expect(dashboardCalls(api).some((r) => r.path.includes("period=year"))).toBe(true);
  const yearRows = page.locator('[data-section="festival-peaks"] table.sr-only tbody tr');
  await expect(yearRows).toHaveCount(YEAR_DAYS.length);
  await expect(yearRows.first()).toContainText(`${YEAR}-01-14`);
  await expect(yearRows.first()).toContainText("Yes");

  const figures = page.locator(".seva figure");
  await expect(figures).toHaveCount(5);
  for (let i = 0; i < 5; i += 1) {
    const table = figures.nth(i).locator("table.sr-only");
    await expect(table).toHaveCount(1);
    expect(await table.locator("tbody tr").count()).toBeGreaterThan(0);
    await expect(table.locator("caption")).not.toBeEmpty();
  }
  await expect(page.locator('[data-section="collections"] table.sr-only tbody tr')).toHaveCount(4);
});

test("a receptionist is sent to the counter", async ({ page }) => {
  const api = dashboardFake();
  await api.install(page);
  await signInAs(page, "receptionist", { redirect: "/admin/receipts" });
  await page.waitForURL((url) => url.pathname === "/admin/receipts/counter", { timeout: 60_000 });
  expect(dashboardCalls(api)).toHaveLength(0);
});

test("period switch never shows a blank dashboard", async ({ page }) => {
  const api = createFakeSevaApi();
  api.extend({
    "GET reports/dashboard": async (req) => {
      const period = (new URL(req.path, "http://localhost").searchParams.get("period") as Period | null) ?? "today";
      if (period !== "today") await sleep(SLOW_MS);
      return answerFor(period);
    },
  });
  await openDashboard(page, api);
  await expect(page.getByTestId("dashboard-content")).toHaveAttribute("data-pending", "false");
  await expect(page.getByTestId("period-pending")).toHaveCount(0);

  // Watch, inside the page, every change after the click: the tiles must never leave and no outline may replace them.
  await page.evaluate(() => {
    const seen = { clickAt: null as number | null, pendingAt: null as number | null, blank: false };
    window.__dashboardWatch = seen;
    const check = () => {
      if (seen.clickAt === null) return;
      if (!document.querySelector('[data-testid="tile-total"]') || document.querySelector("[data-page-skeleton]")) seen.blank = true;
      if (seen.pendingAt === null && document.querySelector('[data-testid="dashboard-content"][data-pending="true"]')) {
        seen.pendingAt = performance.now();
      }
    };
    document.addEventListener(
      "click",
      () => {
        if (seen.clickAt === null) seen.clickAt = performance.now();
        check();
      },
      { capture: true },
    );
    new MutationObserver(check).observe(document.body, { subtree: true, childList: true, attributes: true });
  });

  await page.getByRole("radio", { name: /week/i }).click();
  // While the week loads: the switch has moved, the old tiles and charts stay (dimmed), a spinner turns beside it.
  await expect(page.getByRole("radio", { name: /week/i })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("period-pending")).toBeVisible();
  await expect(page.getByTestId("dashboard-content")).toHaveAttribute("data-pending", "true");
  await expect(page.getByTestId("tile-total")).toContainText("Rs 61,196");
  await expect(page.locator('[data-section="collections"]')).toBeVisible();

  // Then the week's numbers, and the pending marks go.
  await expect(page.getByTestId("tile-total")).toContainText("Rs 3,84,120", { timeout: 10_000 });
  await expect(page.getByTestId("dashboard-content")).toHaveAttribute("data-pending", "false");
  await expect(page.getByTestId("period-pending")).toHaveCount(0);

  const seen = await page.evaluate(() => window.__dashboardWatch);
  expect(seen?.clickAt).not.toBeNull();
  expect(seen?.blank).toBe(false);
  expect((seen?.pendingAt ?? Infinity) - (seen?.clickAt ?? 0)).toBeLessThan(200);
});
