import { expect, test, type Page } from "@playwright/test";
import type { CounterOrderPayload, IssuedReceipt, IssueResponse } from "../../../types/seva";
import { SEVA_ROUTES, receiptPath } from "../../../lib/seva/routes";
import { businessDate } from "../../../lib/seva/time";
import { E2E_PASSWORD, e2eEmail, signInAs } from "./fixtures/auth";
import { createFakeSevaApi, type FakeSevaApi } from "./fixtures/fake-api";

/**
 * Seva Entry's own frames at /seva (plan A4S-2, A4S-3), on a desktop: the full-screen counter, the desk frame with its
 * section rail and Website admin, Sign out on every frame, the old addresses forwarding with their query, and the
 * return to the page opened after sign-in. Every /api/seva/** call is answered by the fake API.
 */

const rail = (page: Page) => page.getByRole("navigation", { name: "Seva Entry sections" });
const header = (page: Page) => page.locator("header[data-seva-header]");
const signOut = (page: Page) => page.getByRole("button", { name: /Sign out/ });

/** One receipt issued through the fake as the temple admin would at the counter. */
async function issueOne(api: FakeSevaApi): Promise<IssuedReceipt> {
  const body: CounterOrderPayload = {
    clientOrderId: "00000000-0000-4000-8000-00000000f001",
    devotee: { name: "Lakshmi Narayan" },
    receipts: [
      {
        clientReceiptId: "00000000-0000-4000-9000-00000000f001",
        sevaDate: businessDate(new Date()),
        qrToken: "TOKENFRAME00000000001",
        lines: [{ sevaId: "seva-archana", quantity: 1 }],
      },
    ],
    payment: { mode: "cash" },
    expectedTotalPaise: 5000,
  };
  const result = await api.handle({ method: "POST", path: "/api/seva/counter/orders", body, role: "temple_admin" });
  if (result.kind !== "json" || result.status !== 200) throw new Error(`fake refused the order: ${JSON.stringify(result)}`);
  return (result.body as IssueResponse).receipts[0];
}

test("a receptionist signs in and lands on the full-screen counter with no section menu", async ({ page }) => {
  await createFakeSevaApi().install(page);
  await signInAs(page, "receptionist");
  await page.waitForURL((url) => url.pathname === "/seva/counter", { timeout: 60_000 });

  await expect(header(page)).toHaveAttribute("data-variant", "focus", { timeout: 60_000 });
  await expect(header(page).getByRole("link", { name: /Today's receipts/ })).toBeVisible();
  await expect(header(page).getByRole("link", { name: /Close day/ })).toBeVisible();
  await expect(signOut(page)).toBeVisible();
  await expect(rail(page)).toHaveCount(0);
  await expect(header(page).getByRole("link", { name: /Website admin/ })).toHaveCount(0);
});

test("a temple admin opening /seva sees the dashboard, the rail and Website admin", async ({ page }) => {
  await createFakeSevaApi().install(page);
  await signInAs(page, "temple_admin", { redirect: SEVA_ROUTES.dashboard });
  await page.waitForURL((url) => url.pathname === "/seva", { timeout: 60_000 });

  await expect(page.getByRole("heading", { level: 1, name: /Dashboard/ })).toBeVisible({ timeout: 60_000 });
  await expect(header(page)).toHaveAttribute("data-variant", "desk");
  await expect(rail(page)).toBeVisible();
  await expect(rail(page).locator('a[href="/seva"]')).toHaveAttribute("aria-current", "page");
  for (const href of ["/seva/counter", "/seva/prasadam", "/seva/register", "/seva/reports", "/admin/users"]) {
    await expect(rail(page).locator(`a[href="${href}"]`)).toBeVisible();
  }
  await expect(header(page).getByRole("link", { name: /Website admin/ })).toHaveAttribute("href", "/admin");
  await expect(signOut(page)).toBeVisible();
});

test("Sign out is visible on the counter, the dashboard, the register, the prasadam page and a receipt page", async ({ page }) => {
  const api = createFakeSevaApi();
  const issued = await issueOne(api);
  if (issued.id === null) throw new Error("the fake issued an online receipt without an id");
  const receiptPage = receiptPath(issued.id);
  await api.install(page);
  await signInAs(page, "temple_admin", { redirect: SEVA_ROUTES.dashboard });
  await expect(page.getByRole("heading", { level: 1, name: /Dashboard/ })).toBeVisible({ timeout: 60_000 });
  await expect(signOut(page)).toBeVisible();

  for (const target of [SEVA_ROUTES.counter, SEVA_ROUTES.register, SEVA_ROUTES.prasadam, receiptPage]) {
    await page.goto(target);
    await page.waitForURL((url) => url.pathname === target, { timeout: 60_000 });
    await expect(signOut(page)).toBeVisible({ timeout: 60_000 });
  }
  await expect(page.getByText(issued.receiptNo).first()).toBeVisible({ timeout: 60_000 });
});

test("old bookmarks forward with their query", async ({ page }) => {
  await createFakeSevaApi().install(page);
  const forwards: [string, string][] = [
    ["/admin/receipts/register?status=changed", "/seva/register?status=changed"],
    ["/admin/prasadam?token=X", "/seva/prasadam?token=X"],
    ["/admin/receipts", "/seva"],
  ];
  for (const [from, to] of forwards) {
    const response = await page.goto(from);
    expect(response, from).not.toBeNull();
    const landed = new URL(response?.url() ?? "");
    expect(`${landed.pathname}${landed.search}`, from).toBe(to);
    expect(response?.request().redirectedFrom(), from).not.toBeNull();
  }
});

test("a signed-out visit to /seva/register comes back to it after sign-in", async ({ page }) => {
  await createFakeSevaApi().install(page);
  await page.goto("/seva/register");
  await page.waitForURL((url) => url.pathname === "/login", { timeout: 60_000 });
  expect(new URL(page.url()).searchParams.get("redirect")).toBe("/seva/register");

  const email = page.locator('input[name="email"]');
  await email.waitFor({ state: "visible", timeout: 60_000 });
  await email.fill(e2eEmail("temple_admin"));
  await page.locator('input[name="password"]').fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => url.pathname === "/seva/register", { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: /Receipts register/ })).toBeVisible({ timeout: 60_000 });
});
