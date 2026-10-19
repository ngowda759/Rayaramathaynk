import { expect, test } from "@playwright/test";
import { signInAs } from "./fixtures/auth";
import { createFakeSevaApi } from "./fixtures/fake-api";

/**
 * Motion and loading foundation (plan A4P-1): a click on a seva link shows the top progress bar and the outline of
 * the page it opens at once, even when that page is slow. Every /api/seva/** call is answered by the fake API.
 */

const SLOW_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

declare global {
  interface Window {
    __sevaFeedback?: { clickAt: number | null; barAt: number | null; outlineAt: number | null };
  }
}

test("a slow page shows the top bar and its outline within 200 ms of the click", async ({ page }) => {
  const crashes: string[] = [];
  page.on("pageerror", (err) => crashes.push(err.message));
  const fake = createFakeSevaApi();
  fake.extend({
    "GET receipts": async () => {
      await sleep(SLOW_MS);
      return { rows: [], nextCursor: null };
    },
  });
  await fake.install(page);
  const meAnswered = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/seva/me", { timeout: 90_000 });
  await signInAs(page, "temple_admin", { redirect: "/admin/receipts" });
  await meAnswered;

  const sidebar = page.locator("aside").filter({ has: page.locator("nav") }).first();
  const register = sidebar.locator('a[href="/admin/receipts/register"]');
  await expect(register).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-route-progress]")).toHaveAttribute("data-state", "idle");

  // Note, inside the page, when the click lands and when the bar and the outline first appear after it.
  await page.evaluate(() => {
    const seen = { clickAt: null as number | null, barAt: null as number | null, outlineAt: null as number | null };
    window.__sevaFeedback = seen;
    const check = () => {
      if (seen.clickAt === null) return;
      const now = performance.now();
      if (seen.barAt === null && document.querySelector('[data-route-progress][data-state="running"]')) seen.barAt = now;
      if (seen.outlineAt === null && document.querySelector("[data-page-skeleton]")) seen.outlineAt = now;
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

  await register.click();
  await page.waitForURL((url) => url.pathname === "/admin/receipts/register", { timeout: 60_000 });

  const seen = await page.evaluate(() => window.__sevaFeedback);
  expect(seen?.clickAt).not.toBeNull();
  expect(seen?.barAt).not.toBeNull();
  expect(seen?.outlineAt).not.toBeNull();
  expect((seen?.barAt ?? Infinity) - (seen?.clickAt ?? 0)).toBeLessThan(200);
  expect((seen?.outlineAt ?? Infinity) - (seen?.clickAt ?? 0)).toBeLessThan(200);

  // The register then fills in, and the bar finishes and goes away.
  await expect(page.getByRole("heading", { name: /Receipts register/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-route-progress]")).toHaveAttribute("data-state", "idle", { timeout: 10_000 });
  expect(crashes).toEqual([]);
});
