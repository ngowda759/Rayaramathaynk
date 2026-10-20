import path from "node:path";
import { expect, test } from "@playwright/test";
import { SEVA_ROUTES } from "../../../lib/seva/routes";
import { E2E_ROLES, signInAs, type E2ERole } from "./fixtures/auth";
import { createFakeSevaApi } from "./fixtures/fake-api";

/**
 * Module shell (plans A3-6, A4S): role landing from /admin and Seva Entry's section rail per role at /seva. Every
 * /api/seva/** call is answered by the fake API; accounts live in the Auth and Firestore emulators (global-setup.ts).
 */

test("a receptionist landing on /admin goes to the counter", async ({ page }) => {
  await createFakeSevaApi().install(page);
  await signInAs(page, "receptionist");
  await page.waitForURL((url) => url.pathname === "/seva/counter", { timeout: 60_000 });
});

test("a prasadam volunteer landing on /admin goes to the prasadam page", async ({ page }) => {
  await createFakeSevaApi().install(page);
  await signInAs(page, "prasadam_counter");
  await page.waitForURL((url) => url.pathname === "/seva/prasadam", { timeout: 60_000 });
});

/**
 * Per role, opened at /seva: where the person lands, and the rail link that shows once it has settled and one it must
 * not show. `null` marks: no rail at all (the counter's full-screen frame, or a person with one section).
 */
const RAIL_MARKS: Record<E2ERole, { lands: string; shown: string | null; hidden: string | null }> = {
  receptionist: { lands: "/seva/counter", shown: null, hidden: null },
  prasadam_counter: { lands: "/seva/prasadam", shown: null, hidden: null },
  temple_admin: { lands: "/seva", shown: "/seva/counter", hidden: null },
  temple_admin_view_only: { lands: "/seva", shown: "/seva/register", hidden: "/seva/counter" },
  super_admin: { lands: "/seva", shown: "/admin/users", hidden: null },
};

test.describe("saves a section rail screenshot per role", () => {
  const shotsDir = process.env.SEVA_SHOTS_DIR;
  test.skip(!shotsDir, "set SEVA_SHOTS_DIR to save the rail screenshots (the wave gate does)");

  for (const role of E2E_ROLES) {
    test(`rail for ${role}`, async ({ page }) => {
      await createFakeSevaApi().install(page);
      const meAnswered = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/seva/me", { timeout: 90_000 });
      await signInAs(page, role, { redirect: SEVA_ROUTES.dashboard });
      await meAnswered;

      const mark = RAIL_MARKS[role];
      await page.waitForURL((url) => url.pathname === mark.lands, { timeout: 60_000 });
      await expect(page.getByRole("button", { name: /Sign out/ })).toBeVisible({ timeout: 60_000 });
      const rail = page.getByRole("navigation", { name: "Seva Entry sections" });
      if (mark.shown === null) {
        await expect(rail).toHaveCount(0);
      } else {
        await expect(rail.locator(`a[href="${mark.shown}"]`)).toBeVisible({ timeout: 60_000 });
      }
      if (mark.hidden !== null) await expect(rail.locator(`a[href="${mark.hidden}"]`)).toHaveCount(0);
      // The owner's screenshots: the whole page, without the Next.js dev indicator (its <nextjs-portal> host exists only
      // under `next dev`; hidden here in the test, the app's config is unchanged).
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await expect(page.locator("nextjs-portal").first()).toBeHidden();
      await page.screenshot({ path: path.join(shotsDir ?? "", `rail-${role}.png`), fullPage: true });
    });
  }
});
