import { expect, test } from "@playwright/test";
import { GOTRAS } from "../../../lib/seva/domain/gotras";
import { NAKSHATRAS } from "../../../lib/seva/domain/nakshatras";
import type { DomainOption } from "../../../lib/seva/domain/options";
import { RASHIS } from "../../../lib/seva/domain/rashis";
import type { ListItemSaveRequest } from "../../../lib/seva/schemas";
import { LISTS_TEXT } from "../../../lib/seva/strings/lists";
import type { CounterBootstrap, SevaListItem, SevaLists } from "../../../types/seva";
import { signInAs } from "./fixtures/auth";
import { registerThisPc, stubPrint } from "./fixtures/counter";
import { createFakeSevaApi, FakeApiError, type FakeSevaApi } from "./fixtures/fake-api";
import { SEVA_ROUTES } from "../../../lib/seva/routes";

/**
 * Settings - Devotee lists (plan A4P-5): temple admins add a gotra, hide one, and correct Kannada spellings; the
 * counter's gotra picker then offers what they saved. Every /api/seva/** call is answered by the fake API; this file
 * adds the lists routes in their real wire shape and puts the same lists into the counter bootstrap.
 */

const LISTS_PAGE = SEVA_ROUTES.settingsLists;
const COUNTER = SEVA_ROUTES.counter;

function toItems(options: readonly DomainOption[]): SevaListItem[] {
  return options.map((o) => ({ id: o.id, nameEn: o.en, nameKn: o.kn, knChecked: false, active: true, displayOrder: o.id }));
}

function listsFake(): { fake: FakeSevaApi; lists: SevaLists } {
  const fake = createFakeSevaApi();
  const lists: SevaLists = { gotras: toItems(GOTRAS), nakshatras: toItems(NAKSHATRAS), rashis: toItems(RASHIS) };
  // The counter bootstrap as the fake builds it, plus the lists (a second fake over the same state builds the base).
  const base = createFakeSevaApi(fake.state);
  fake.extend({
    "GET settings/lists": () => lists,
    "POST settings/lists": (req) => {
      const body = req.body as ListItemSaveRequest;
      if (body.kind !== "gotra") {
        const list = body.kind === "nakshatra" ? lists.nakshatras : lists.rashis;
        const found = list.find((i) => i.id === body.id);
        if (!found) throw new FakeApiError(404, "not_found");
        Object.assign(found, { nameKn: body.nameKn, knChecked: true });
        return { kind: body.kind, item: found };
      }
      if (body.id === undefined) {
        const id = Math.max(999, ...lists.gotras.map((g) => g.id)) + 1;
        const item: SevaListItem = {
          id,
          nameEn: body.nameEn ?? "",
          nameKn: body.nameKn ?? null,
          knChecked: body.nameKn !== undefined,
          active: body.active ?? true,
          displayOrder: id,
        };
        lists.gotras.push(item);
        return { kind: "gotra", item };
      }
      const found = lists.gotras.find((g) => g.id === body.id);
      if (!found) throw new FakeApiError(404, "not_found");
      if (body.nameEn !== undefined) found.nameEn = body.nameEn;
      if (body.nameKn !== undefined) Object.assign(found, { nameKn: body.nameKn, knChecked: true });
      if (body.active !== undefined) found.active = body.active;
      return { kind: "gotra", item: found };
    },
    "GET counter/bootstrap": async (req) => {
      const answer = await base.handle({ ...req, role: "temple_admin" });
      if (answer.kind !== "json") throw new Error("the base bootstrap failed");
      return { ...(answer.body as CounterBootstrap), lists };
    },
  });
  return { fake, lists };
}

test("a temple admin adds a gotra and the counter offers it", async ({ page }) => {
  const { fake, lists } = listsFake();
  await fake.install(page);
  await stubPrint(page);
  await signInAs(page, "temple_admin", { redirect: LISTS_PAGE });
  await page.waitForURL((url) => url.pathname === LISTS_PAGE, { timeout: 60_000 });

  await expect(page.getByRole("heading", { name: /Devotee lists/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("tab", { name: /^Gotra/ })).toHaveAttribute("aria-selected", "true");
  // Every built-in Kannada name is still to be proof-read.
  await expect(page.getByTestId("unchecked-count-gotra")).toHaveText(String(GOTRAS.length));

  // Add a gotra with its Kannada name.
  await page.getByRole("button", { name: /Add gotra/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/English name/).fill("Vyaghrapada");
  await dialog.getByLabel(/Kannada name/).fill("ವ್ಯಾಘ್ರಪಾದ");
  await dialog.getByRole("button", { name: /^Save/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("row", { name: /Vyaghrapada/ })).toBeVisible();
  expect(fake.requests.filter((r) => r.method === "POST" && r.path.includes("settings/lists")).map((r) => r.body)).toEqual([
    { kind: "gotra", nameEn: "Vyaghrapada", nameKn: "ವ್ಯಾಘ್ರಪಾದ" },
  ]);

  // Hide one: it stays on the page, marked hidden, and the counter no longer offers it.
  await page.getByLabel(/Search gotras/).fill("Shandilya");
  await page.getByRole("button", { name: "Hide Shandilya" }).click();
  await expect(page.getByRole("button", { name: "Show Shandilya" })).toBeVisible();
  expect(lists.gotras.find((g) => g.id === 12)?.active).toBe(false);

  // A nakshatra's Kannada spelling can be corrected; its English name cannot.
  await page.getByRole("tab", { name: /^Nakshatra/ }).click();
  await page.getByRole("button", { name: "Edit Kannada of Purva Bhadrapada" }).click();
  await expect(dialog.getByLabel(/English name/)).toHaveCount(0);
  await dialog.getByLabel(/Kannada name/).fill("ಪೂರ್ವಾಭಾದ್ರಪದ");
  await dialog.getByRole("button", { name: /^Save/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("unchecked-count-nakshatra")).toHaveText(String(NAKSHATRAS.length - 1));

  // The counter offers the new gotra, with its Kannada, and not the hidden one.
  await page.goto(COUNTER);
  await registerThisPc(page);
  await page.reload();
  await expect(page.locator("#counter-name")).toBeFocused({ timeout: 60_000 });
  await page.locator("#counter-gotra").fill("Vyag");
  await expect(page.getByRole("option", { name: /Vyaghrapada/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Vyaghrapada/ })).toContainText("ವ್ಯಾಘ್ರಪಾದ");
  await page.locator("#counter-gotra").fill("Shandil");
  await expect(page.getByRole("option", { name: /Shandilya/ })).toHaveCount(0);
});

test("a view-only temple admin sees the lists but cannot change them", async ({ page }) => {
  const { fake } = listsFake();
  await fake.install(page);
  await signInAs(page, "temple_admin_view_only", { redirect: LISTS_PAGE });
  await page.waitForURL((url) => url.pathname === LISTS_PAGE, { timeout: 60_000 });
  await expect(page.getByRole("row", { name: /Kashyapa/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: /Add gotra/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Hide / })).toHaveCount(0);
  await expect(page.getByText(LISTS_TEXT.viewOnly)).toBeVisible();
});
