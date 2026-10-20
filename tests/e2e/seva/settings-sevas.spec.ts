import { expect, test, type Page } from "@playwright/test";
import { addDays, businessDate, formatSevaDate } from "../../../lib/seva/time";
import type { DenominationsRequest, FestivalRequest } from "../../../lib/seva/schemas";
import type { FestivalItem } from "../../../types/seva-settings";
import { signInAs, type E2ERole } from "./fixtures/auth";
import { createFakeSevaApi, type FakeSevaApi } from "./fixtures/fake-api";
import { SEVA_ROUTES } from "../../../lib/seva/routes";

/**
 * Settings - sevas, cash denominations and festival days (plan A4-9; DB §13.1, §13.3, §13.4). Every /api/seva/** call
 * is answered by the fake API; this file answers the catalogue and settings routes in their real wire shape
 * (`{ sevas }`, `{ history }`, `{ items }`, `{ festivals }`, PUT reorder) on top of it.
 */

const SEVAS = SEVA_ROUTES.sevaSettings;
const DENOMINATIONS = SEVA_ROUTES.settingsDenominations;
const FESTIVALS = SEVA_ROUTES.settingsFestivalDays;
const TODAY = businessDate(new Date());

interface SettingsFake {
  fake: FakeSevaApi;
  denominations: DenominationsRequest;
  festivals: FestivalItem[];
}

function settingsFake(): SettingsFake {
  const fake = createFakeSevaApi();
  const denominations: DenominationsRequest = {
    items: [
      { kind: "note", valuePaise: 50_000, displayOrder: 1, shown: true },
      { kind: "note", valuePaise: 10_000, displayOrder: 2, shown: true },
      { kind: "coin", valuePaise: 1_000, displayOrder: 3, shown: true },
      { kind: "coin", valuePaise: 100, displayOrder: 4, shown: false },
    ],
  };
  const festivals: FestivalItem[] = [
    { id: "fest-aradhane-2026", nameEn: "Aradhane 2026", nameKn: "ಆರಾಧನೆ", active: true, dates: ["2026-08-28", "2026-08-29", "2026-08-30"] },
  ];
  let seq = 0;
  fake.extend({
    "GET sevas": () => ({ sevas: [...fake.state.catalogue].sort((a, b) => a.key - b.key) }),
    "PUT sevas/reorder": (req) => {
      const ids = (req.body as { ids: string[] }).ids;
      ids.forEach((id, i) => {
        const seva = fake.state.catalogue.find((s) => s.id === id);
        if (seva) seva.key = i + 1;
      });
      return { ok: true };
    },
    "GET sevas/:id": () => ({ history: [] }),
    "GET settings/denominations": () => denominations,
    "PUT settings/denominations": (req) => {
      denominations.items = (req.body as DenominationsRequest).items;
      return { ok: true };
    },
    "GET settings/festivals": () => ({ festivals }),
    "POST settings/festivals": (req) => {
      const body = req.body as FestivalRequest;
      const id = `fest-new-${++seq}`;
      festivals.push({ id, nameEn: body.nameEn, nameKn: body.nameKn, active: body.active, dates: [...body.dates] });
      return { id };
    },
  });
  return { fake, denominations, festivals };
}

async function open(page: Page, role: E2ERole, path: string): Promise<SettingsFake> {
  const setup = settingsFake();
  await setup.fake.install(page);
  await signInAs(page, role, { redirect: path });
  return setup;
}

function writes(fake: FakeSevaApi): { method: string; path: string }[] {
  return fake.requests.filter((r) => r.method !== "GET");
}

test("dragging a seva changes its counter key", async ({ page }) => {
  const { fake } = await open(page, "temple_admin", SEVAS);
  await expect(page.getByTestId("seva-key-seva-paaduka")).toHaveText("3", { timeout: 60_000 });

  // Paaduka Pooja (key 3) dragged onto Archana (key 1) becomes key 1.
  await page.getByTestId("seva-handle-seva-paaduka").dragTo(page.getByTestId("seva-row-seva-archana"));

  await expect.poll(() => fake.requests.filter((r) => r.method === "PUT" && r.path === "/api/seva/sevas/reorder").length).toBe(1);
  const sent = fake.requests.find((r) => r.method === "PUT" && r.path === "/api/seva/sevas/reorder");
  expect((sent?.body as { ids: string[] }).ids.slice(0, 3)).toEqual(["seva-paaduka", "seva-archana", "seva-abhisheka"]);
  await expect(page.getByTestId("seva-key-seva-paaduka")).toHaveText("1");
  await expect(page.getByTestId("seva-key-seva-archana")).toHaveText("2");

  // The keyboard way gives the same result: Move down puts it back to key 2.
  await page.getByRole("button", { name: "Move Paaduka Pooja down" }).click();
  await expect(page.getByTestId("seva-key-seva-paaduka")).toHaveText("2");
});

test("a denomination of Rs 2,500 is refused", async ({ page }) => {
  const { fake, denominations } = await open(page, "temple_admin", DENOMINATIONS);
  await expect(page.getByTestId("denomination-table")).toContainText("Rs 500", { timeout: 60_000 });

  await page.getByRole("radio", { name: /^Note/ }).click();
  await page.getByLabel("Value").fill("2500");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Type a value from 1 to 2,000.")).toBeVisible();
  await expect(page.getByTestId("denomination-table")).not.toContainText("Rs 2,500");
  await expect(page.getByRole("button", { name: "Save settings" })).toBeDisabled();

  // Rs 2,000 is allowed, shows in the day-close preview and is saved last.
  await page.getByLabel("Value").fill("2000");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByTestId("denomination-preview")).toContainText("Rs 2,000 note");
  // A hidden row is not in the preview.
  await expect(page.getByTestId("denomination-preview")).not.toContainText("Rs 1 coin");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Denominations saved.", { exact: false })).toBeVisible();

  const put = fake.requests.filter((r) => r.method === "PUT" && r.path === "/api/seva/settings/denominations");
  expect(put).toHaveLength(1);
  expect(denominations.items).toHaveLength(5);
  expect(denominations.items[4]).toEqual({ kind: "note", valuePaise: 200_000, displayOrder: 5, shown: true });
});

test("a removed denomination leaves the table and a slow save shows Saving... then the saved line", async ({ page }) => {
  const { fake, denominations } = await open(page, "temple_admin", DENOMINATIONS);
  // The office takes 800 ms to answer (plan A4P-4).
  fake.extend({
    "PUT settings/denominations": async (req) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      denominations.items = (req.body as DenominationsRequest).items;
      return { ok: true };
    },
  });
  const table = page.getByTestId("denomination-table");
  await expect(table).toContainText("Rs 500", { timeout: 60_000 });

  // The removed row fades out and is gone (it is never left half-visible in the table).
  await page.getByRole("button", { name: "Remove Rs 1 coin" }).click();
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(table).not.toContainText(/Rs 1(?![\d,])/);

  await page.getByRole("button", { name: "Save settings" }).click();
  const saving = page.locator('button[aria-busy="true"]');
  await expect(saving).toContainText("Saving...", { timeout: 600 });
  await expect(saving).toBeDisabled();
  await expect(page.getByText("Denominations saved.", { exact: false })).toBeVisible();
  expect(denominations.items).toHaveLength(3);
  expect(fake.requests.filter((r) => r.method === "PUT" && r.path === "/api/seva/settings/denominations")).toHaveLength(1);
});

test("a festival with three dates appears as a chip source", async ({ page }) => {
  const { fake, festivals } = await open(page, "temple_admin", FESTIVALS);
  await expect(page.getByTestId("festival-table")).toContainText("Aradhane 2026", { timeout: 60_000 });

  // Three days next month.
  const next = addDays(`${TODAY.slice(0, 8)}01`, 40);
  const month = next.slice(0, 8);
  const days = [`${month}08`, `${month}09`, `${month}10`];

  await page.getByRole("button", { name: /Add festival days/ }).click();
  await page.getByLabel(/^Name in English/).fill("Deepavali");
  await page.getByLabel(/^Name in Kannada/).fill("ದೀಪಾವಳಿ");
  while (!(await page.getByRole("button", { name: formatSevaDate(days[0]) }).isVisible())) {
    await page.getByRole("button", { name: "Next month" }).click();
  }
  for (const day of days) await page.getByRole("button", { name: formatSevaDate(day) }).click();

  await expect(page.getByTestId("festival-count")).toHaveText("3 dates picked");
  const monthName = formatSevaDate(days[0]).split(" ")[2];
  await expect(page.getByTestId("festival-chip-preview")).toHaveText(`Deepavali 8 / 9 / 10 ${monthName}`);
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByTestId("festival-row-fest-new-1")).toContainText("Showing");
  await expect(page.getByTestId("festival-row-fest-new-1")).toContainText(`8, 9, 10 ${monthName}`);
  const posted = fake.requests.filter((r) => r.method === "POST" && r.path === "/api/seva/settings/festivals");
  expect(posted).toHaveLength(1);
  expect(posted[0].body).toEqual({ nameEn: "Deepavali", nameKn: "ದೀಪಾವಳಿ", active: true, dates: days });
  expect(festivals.find((f) => f.id === "fest-new-1")?.dates).toEqual(days);
  // A festival whose dates have passed is not a chip source any more.
  await expect(page.getByTestId("festival-row-fest-aradhane-2026")).toContainText(TODAY > "2026-08-30" ? "Past" : "Showing");
});

test("view-only temple admins cannot edit", async ({ page }) => {
  const { fake } = await open(page, "temple_admin_view_only", SEVAS);
  await expect(page.getByTestId("seva-table")).toContainText("Paaduka Pooja", { timeout: 60_000 });
  await expect(page.getByRole("button", { name: /Add seva/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Move .* up/ })).toHaveCount(0);
  await expect(page.getByRole("switch", { name: "Paaduka Pooja active" })).toBeDisabled();
  await page.getByRole("button", { name: "View Paaduka Pooja" }).click();
  await expect(page.getByLabel(/^Name in English/)).toBeDisabled();
  await expect(page.getByRole("button", { name: /Save changes/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.goto(DENOMINATIONS);
  await expect(page.getByTestId("denomination-table")).toContainText("Rs 500", { timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Save settings" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add", exact: true })).toHaveCount(0);

  await page.goto(FESTIVALS);
  await expect(page.getByTestId("festival-table")).toContainText("Aradhane 2026", { timeout: 60_000 });
  await expect(page.getByRole("button", { name: /Add festival days/ })).toHaveCount(0);

  expect(writes(fake)).toHaveLength(0);
});
