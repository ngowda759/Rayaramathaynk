import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import type { ContinuityRow } from "../../../types/seva-reports";
import type { CounterItem, CounterRules } from "../../../types/seva-settings";
import { signInAs } from "./fixtures/auth";
import { DEFAULT_SLIP } from "./fixtures/data";
import { createFakeSevaApi, type FakeRequest, type FakeSevaApi } from "./fixtures/fake-api";

/**
 * Settings - receipt template and numbering, counters and devices, counter rules (plan A4-10, DB §13.2, §8.4).
 * Every /api/seva/** call is answered by the fake API; this file answers the settings, continuity and device routes in
 * their real wire shapes on top of it.
 */

const RECEIPT_PAGE = "/admin/receipts/settings/receipt";
const COUNTERS_PAGE = "/admin/receipts/settings/counters";
const RULES_PAGE = "/admin/receipts/settings/rules";
const YEAR = new Date().getFullYear();

const COUNTER: CounterItem = {
  id: 1,
  name: "Counter 1",
  place: "Office PC",
  openingFloatPaise: 50_000,
  active: true,
  onlineSeries: "C1",
  offlineSeries: "OF1",
};

const RULES: CounterRules = {
  cancelWindowMinutes: 30,
  counterDaysAhead: 365,
  onlineDaysAhead: 90,
  onlineSameDayCutoff: "12:00",
  prasadamUndoSeconds: 60,
  dayCloseFlagThresholdPaise: 10_000,
  tallyCashLedger: "Cash",
  tallyUpiLedger: "Bank",
  tallyOnlineLedger: "Bank",
  tallyColumns: null,
};

function continuity(): ContinuityRow[] {
  return [
    { series: "C1", year: YEAR, counterName: "Counter 1", firstNo: `C1-023-01-${YEAR}/000001`, lastNo: `C1-023-10-${YEAR}/000227`, numbers: 227, issued: 220, cancelled: 7, openGaps: 0 },
    { series: "OF1", year: YEAR, counterName: "Counter 1", firstNo: `OF1-023-03-${YEAR}/000001`, lastNo: `OF1-023-10-${YEAR}/000005`, numbers: 5, issued: 5, cancelled: 0, openGaps: 0 },
  ];
}

/** The fake with the settings routes in their real shapes. */
function settingsFake(): FakeSevaApi {
  const fake = createFakeSevaApi();
  // This browser keeps no counter key, so it sends no device header and the real /me names no counter for it.
  fake.state.me.temple_admin.counter = null;
  fake.state.me.temple_admin_view_only.counter = null;
  let template = { ...DEFAULT_SLIP };
  let rules = { ...RULES };
  fake.extend({
    "GET settings/template": () => template,
    "PUT settings/template": (req) => {
      template = { ...template, ...(req.body as Partial<typeof template>) };
      return { ok: true };
    },
    "GET settings/rules": () => rules,
    "PUT settings/rules": (req) => {
      rules = { ...rules, ...(req.body as Partial<CounterRules>) };
      return { ok: true };
    },
    "GET settings/counters": () => ({ counters: [COUNTER] }),
    "GET reports/continuity": () => continuity(),
    "POST counter/devices": (req) => {
      const body = req.body as { action: string };
      return { deviceId: body.action === "replace" ? "device-e2e-replaced" : "device-e2e-new" };
    },
  });
  return fake;
}

async function open(page: Page, path: string, role: "temple_admin" | "temple_admin_view_only" = "temple_admin"): Promise<FakeSevaApi> {
  const fake = settingsFake();
  await fake.install(page);
  await signInAs(page, role, { redirect: path });
  await page.waitForURL((url) => url.pathname === path, { timeout: 60_000 });
  return fake;
}

function devicePosts(fake: FakeSevaApi): FakeRequest[] {
  return fake.requests.filter((r) => r.method === "POST" && r.path === "/api/seva/counter/devices");
}

/** The device credentials this PC keeps in its counter database (lib/seva/offline/device.ts). */
async function storedDevice(page: Page): Promise<{ deviceId: string; secret: string } | null> {
  return page.evaluate(
    () =>
      new Promise<{ deviceId: string; secret: string } | null>((resolve, reject) => {
        const req = indexedDB.open("seva-counter");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const get = db.transaction("meta", "readonly").objectStore("meta").get("device");
          get.onsuccess = () => {
            db.close();
            resolve((get.result as { deviceId: string; secret: string } | undefined) ?? null);
          };
          get.onerror = () => reject(get.error);
        };
      }),
  );
}

test("the receipts tab previews the four numbering formats and the yearly restart line", async ({ page }) => {
  await open(page, RECEIPT_PAGE);
  const card = page.getByTestId("numbering-preview");
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card.locator('[data-format="online"]')).toContainText(/C1-\d{3}-\d{2}-\d{4}\/000124/);
  await expect(card.locator('[data-format="offline"]')).toContainText(/OF1-\d{3}-\d{2}-\d{4}\/000007/);
  await expect(card.locator('[data-format="web"]')).toContainText(/W-WEB-\d{2}-\d{4}\/000045/);
  await expect(card.locator('[data-format="app"]')).toContainText(/W-APP-\d{2}-\d{4}\/000046/);
  await expect(card).toContainText("The running number continues all year and starts again on 1 January");
});

test("register this PC sends only the hash and stores the secret locally", async ({ page }) => {
  const fake = await open(page, COUNTERS_PAGE);
  await expect(page.getByText(`C1-023-10-${YEAR}/000227`)).toBeVisible({ timeout: 60_000 });

  await page.getByRole("button", { name: "Register this PC" }).click();
  await page.getByLabel(/Name for this PC/).fill("Office PC");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "This PC is now Counter 1." })).toBeVisible();

  const posts = devicePosts(fake);
  expect(posts).toHaveLength(1);
  const body = posts[0].body as Record<string, unknown>;
  expect(body.action).toBe("register");
  expect(body.counterId).toBe(1);
  expect(body.secretHash).toMatch(/^[0-9a-f]{64}$/);
  expect(body).not.toHaveProperty("secret");

  const stored = await storedDevice(page);
  expect(stored?.deviceId).toBe("device-e2e-new");
  expect(stored?.secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(createHash("sha256").update(stored?.secret ?? "", "utf8").digest("hex")).toBe(body.secretHash);
  expect(JSON.stringify(fake.requests)).not.toContain(stored?.secret ?? "<none>");
});

test("replace this PC needs the last slip number and a reason", async ({ page }) => {
  const fake = await open(page, COUNTERS_PAGE);
  await expect(page.getByText(`OF1-023-10-${YEAR}/000005`)).toBeVisible({ timeout: 60_000 });

  await page.getByRole("button", { name: "Replace this PC" }).click();
  await expect(page.getByText(/never sent become a gap/)).toBeVisible();
  const move = page.getByRole("button", { name: "Move Counter 1 to this PC" });

  await move.click();
  await expect(page.getByText(/Check the number/)).toBeVisible();
  await expect(page.getByText(/Give a reason/)).toBeVisible();
  expect(devicePosts(fake)).toHaveLength(0);

  await page.getByLabel(/Last printed offline receipt number/).fill(`OF1-023-10-${YEAR}/000009`);
  await expect(page.getByText("OF1 numbers 6 to 9 will be listed as a gap until an admin explains them.")).toBeVisible();
  await move.click();
  expect(devicePosts(fake)).toHaveLength(0);

  await page.getByLabel(/^Reason/).fill("Old PC stopped working");
  await move.click();
  await expect(page.getByRole("status").filter({ hasText: "This PC is now Counter 1." })).toBeVisible();

  const body = devicePosts(fake)[0].body as Record<string, unknown>;
  expect(body).toMatchObject({ action: "replace", counterId: 1, lastPrintedOfNo: 9, reason: "Old PC stopped working" });
  expect(body.secretHash).toMatch(/^[0-9a-f]{64}$/);
  expect(body).not.toHaveProperty("secret");
  expect((await storedDevice(page))?.deviceId).toBe("device-e2e-replaced");
});

test("the slip preview follows the header fields", async ({ page }) => {
  const fake = await open(page, RECEIPT_PAGE);
  const slip = page.getByTestId("slip-preview").locator("article.slip");
  await expect(slip).toContainText(DEFAULT_SLIP.templeNameEn, { timeout: 60_000 });
  await expect(slip).toContainText("Kashyapa");

  await page.getByLabel(/Temple name, English/).fill("Rayara Matha, Yelahanka");
  await page.getByLabel(/Footer line 1/).fill("Sevas begin at 7 am.");
  await page.getByRole("checkbox", { name: /Gotra/ }).uncheck();
  await expect(slip).toContainText("Rayara Matha, Yelahanka");
  await expect(slip).toContainText("Sevas begin at 7 am.");
  await expect(slip).not.toContainText("Kashyapa");

  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  const put = fake.requests.find((r) => r.method === "PUT" && r.path === "/api/seva/settings/template");
  expect(put?.body).toEqual({ templeNameEn: "Rayara Matha, Yelahanka", footerLine1: "Sevas begin at 7 am.", printGotra: false });
});

test("counter rules save and are audited", async ({ page }) => {
  const fake = await open(page, RULES_PAGE);
  await expect(page.getByLabel(/Cancel window/)).toHaveValue("30", { timeout: 60_000 });
  await expect(page.getByRole("switch", { name: /Note for a cash difference/ })).toBeDisabled();

  await page.getByLabel(/Cancel window/).fill("45");
  await page.getByLabel(/flag threshold/).fill("250");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  // The office writes the audit row inside the save (seva_save_settings via PUT /settings/rules); the page's part is
  // to send exactly the changed rules there.
  const put = fake.requests.find((r) => r.method === "PUT" && r.path === "/api/seva/settings/rules");
  expect(put?.body).toEqual({ cancelWindowMinutes: 45, counterDaysAhead: 365, dayCloseFlagThresholdPaise: 25_000 });
});

test("a slow save shows Saving... at once and then the saved line", async ({ page }) => {
  const fake = await open(page, RULES_PAGE);
  // The office takes 800 ms to answer (plan A4P-4): the button says so meanwhile and cannot send twice.
  fake.extend({
    "PUT settings/rules": async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return { ok: true };
    },
  });
  await expect(page.getByLabel(/Cancel window/)).toHaveValue("30", { timeout: 60_000 });

  await page.getByLabel(/Cancel window/).fill("40");
  await page.getByRole("button", { name: "Save settings" }).click();
  const saving = page.locator('button[aria-busy="true"]');
  await expect(saving).toContainText("Saving...", { timeout: 600 });
  await expect(saving).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save settings" })).toBeEnabled();
  expect(fake.requests.filter((r) => r.method === "PUT" && r.path === "/api/seva/settings/rules")).toHaveLength(1);
});

test("view-only temple admins see the settings without anything to change", async ({ page }) => {
  await open(page, RULES_PAGE, "temple_admin_view_only");
  await expect(page.getByLabel(/Cancel window/)).toHaveValue("30", { timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Save settings" })).toHaveCount(0);

  await page.goto(COUNTERS_PAGE);
  await expect(page.getByText(`C1-023-10-${YEAR}/000227`)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Register this PC" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Add a counter/ })).toHaveCount(0);
});
