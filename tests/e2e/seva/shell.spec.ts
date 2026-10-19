import path from "node:path";
import { expect, test } from "@playwright/test";
import { E2E_ROLES, signInAs, type E2ERole } from "./fixtures/auth";
import { createFakeSevaApi } from "./fixtures/fake-api";

/**
 * Module shell (plan A3-6): role landing on /admin and the sidebar per role. Every /api/seva/** call is answered by
 * the fake API; accounts live in the Auth and Firestore emulators (global-setup.ts).
 */

test("a receptionist landing on /admin goes to the counter", async ({ page }) => {
  await createFakeSevaApi().install(page);
  await signInAs(page, "receptionist");
  await page.waitForURL((url) => url.pathname === "/admin/receipts/counter", { timeout: 60_000 });
});

test("a prasadam volunteer landing on /admin goes to the prasadam page", async ({ page }) => {
  await createFakeSevaApi().install(page);
  await signInAs(page, "prasadam_counter");
  await page.waitForURL((url) => url.pathname === "/admin/prasadam", { timeout: 60_000 });
});

/** A link every role's sidebar shows once it has settled, and one it must not show. */
const SIDEBAR_MARKS: Record<E2ERole, { shown: string; hidden: string }> = {
  receptionist: { shown: "/admin/receipts/counter", hidden: "/admin/receipts/register" },
  prasadam_counter: { shown: "/admin/prasadam", hidden: "/admin/receipts/counter" },
  temple_admin: { shown: "/admin/receipts/counter", hidden: "/admin/temple-areas" },
  temple_admin_view_only: { shown: "/admin/receipts/register", hidden: "/admin/receipts/counter" },
  super_admin: { shown: "/admin/temple-areas", hidden: "/admin/nothing-here" },
};

test.describe("saves a sidebar screenshot per role", () => {
  const shotsDir = process.env.SEVA_SHOTS_DIR;
  test.skip(!shotsDir, "set SEVA_SHOTS_DIR to save the sidebar screenshots (the wave gate does)");

  for (const role of E2E_ROLES) {
    test(`sidebar for ${role}`, async ({ page }) => {
      await createFakeSevaApi().install(page);
      const meAnswered = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/seva/me", { timeout: 90_000 });
      // /admin/receipts is not /admin, so no landing redirect; its layout loads the seva profile.
      await signInAs(page, role, { redirect: "/admin/receipts" });
      await meAnswered;

      const sidebar = page.locator("aside").filter({ has: page.locator("nav") }).first();
      const mark = SIDEBAR_MARKS[role];
      await expect(sidebar.locator(`a[href="${mark.shown}"]`)).toBeVisible({ timeout: 60_000 });
      await expect(sidebar.locator(`a[href="${mark.hidden}"]`)).toHaveCount(0);
      // The owner's screenshots: the whole page, without the Next.js dev indicator (its <nextjs-portal> host exists only
      // under `next dev`; hidden here in the test, the app's config is unchanged).
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await expect(page.locator("nextjs-portal").first()).toBeHidden();
      await page.screenshot({ path: path.join(shotsDir ?? "", `sidebar-${role}.png`), fullPage: true });
    });
  }
});
