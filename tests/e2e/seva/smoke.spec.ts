import { expect, test } from "@playwright/test";
import { signInAs } from "./fixtures/auth";
import { createFakeSevaApi } from "./fixtures/fake-api";

// A temple admin stays on /admin; receptionists and prasadam volunteers land on their own page (shell.spec.ts).
test("a temple admin can sign in and open the admin shell", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const api = createFakeSevaApi();
  await api.install(page);

  await signInAs(page, "temple_admin");
  await page.goto("/admin");

  await expect(page.locator("#main-content")).toBeVisible({ timeout: 90_000 });
  expect(new URL(page.url()).pathname).toBe("/admin");
  expect(pageErrors).toEqual([]);
});
