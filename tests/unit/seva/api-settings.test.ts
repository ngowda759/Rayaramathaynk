/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import type { SevaError } from "@/lib/seva/errors";
import type { can, isWriteAction, SevaActor } from "@/lib/seva/permissions";
import { settingsPatchSchema } from "@/lib/seva/schemas";
import type { SevaAction } from "@/types/seva";

jest.mock("server-only", () => ({}), { virtual: true });

// ---- The guard: the real permission matrix over a chosen actor (the guard itself is tested in seva-auth.test.ts) ----
const mockGuard = { actor: null as SevaActor | null, actions: [] as SevaAction[] };

jest.mock("@/lib/seva/server/auth", () => ({
  requireSevaActor: async (_req: unknown, action: SevaAction) => {
    const { sevaErrorResponse } = jest.requireActual("@/lib/seva/server/respond") as {
      sevaErrorResponse: (e: unknown) => NextResponse;
    };
    const { SevaError: Err } = jest.requireActual("@/lib/seva/errors") as { SevaError: typeof SevaError };
    const perms = jest.requireActual("@/lib/seva/permissions") as { can: typeof can; isWriteAction: typeof isWriteAction };
    mockGuard.actions.push(action);
    const actor = mockGuard.actor;
    if (!actor) return { ok: false, response: sevaErrorResponse(new Err("unauthenticated")) };
    if (actor.viewOnly && perms.isWriteAction(action)) return { ok: false, response: sevaErrorResponse(new Err("view_only")) };
    if (!perms.can(actor, action)) return { ok: false, response: sevaErrorResponse(new Err("forbidden")) };
    return { ok: true, actor, device: null };
  },
}));

const mockCallRpc = jest.fn();
jest.mock("@/lib/seva/server/rpc", () => ({ callRpc: (...args: unknown[]) => mockCallRpc(...args) }));

// ---- Supabase: a chainable read-only stand-in; every awaited query answers from mockTables[table] -------------------
type Row = Record<string, unknown>;
const mockTables: Record<string, Row[]> = {};

function mockQuery(table: string) {
  const filters: [string, unknown][] = [];
  const rows = () => (mockTables[table] ?? []).filter((row) => filters.every(([col, value]) => row[col] === value));
  const query = {
    select: () => query,
    order: () => query,
    eq: (col: string, value: unknown) => {
      filters.push([col, value]);
      return query;
    },
    maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
  };
  return query;
}
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => mockQuery(t) }) }));

import { GET as getTemplate, PUT as putTemplate } from "@/app/api/seva/settings/template/route";
import { GET as getRules, PUT as putRules } from "@/app/api/seva/settings/rules/route";
import { GET as getDenominations, PUT as putDenominations } from "@/app/api/seva/settings/denominations/route";
import { GET as getFestivals, POST as postFestival } from "@/app/api/seva/settings/festivals/route";
import { PUT as putFestival } from "@/app/api/seva/settings/festivals/[id]/route";
import { GET as getCounters, POST as postCounter } from "@/app/api/seva/settings/counters/route";
import { PUT as putCounter } from "@/app/api/seva/settings/counters/[id]/route";

const FESTIVAL_ID = "33333333-3333-4333-8333-333333333333";

const ADMIN: SevaActor = { staffId: "s-admin", uid: "u-admin", role: "temple_admin", viewOnly: false, staffNo: 2, name: "Admin" };
const VIEWER: SevaActor = { ...ADMIN, staffId: "s-view", viewOnly: true };
const RECEPTIONIST: SevaActor = { ...ADMIN, staffId: "s-rec", role: "receptionist", staffNo: 23 };

const SETTINGS_ROW: Row = {
  id: 1,
  temple_name_en: "SAMPLE - Sri Raghavendra Swamy Matha",
  temple_name_kn: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ",
  address_line1: "Line 1",
  address_line2: "Line 2",
  registration_line: null,
  photo_left_url: null,
  photo_right_url: null,
  footer_line1: "Footer 1",
  footer_line2: "Footer 2",
  footer_blessing: "Blessing",
  print_gotra: true,
  print_nakshatra: true,
  print_rashi: false,
  cancel_window_minutes: 30,
  cash_difference_note_required: true,
  amount_change_reason_required: true,
  counter_days_ahead: 365,
  online_days_ahead: 90,
  online_same_day_cutoff: "12:00:00",
  prasadam_undo_seconds: 120,
  day_close_flag_threshold: 50,
  tally_cash_ledger: "Cash",
  tally_upi_ledger: "Bank - UPI",
  tally_online_ledger: "Gateway clearing",
  tally_columns: null,
};

function req(method: string, path: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/seva/${path}`, {
    method,
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const idParams = (id: string) => ({ params: Promise.resolve({ id }) });

async function errorCode(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGuard.actor = ADMIN;
  mockGuard.actions = [];
  for (const key of Object.keys(mockTables)) delete mockTables[key];
  mockTables.seva_settings = [{ ...SETTINGS_ROW }];
  mockCallRpc.mockResolvedValue(null);
});

describe("settings routes", () => {
  it("reads the slip template and saves only template fields", async () => {
    const read = await getTemplate(req("GET", "settings/template"));
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual({
      templeNameEn: "SAMPLE - Sri Raghavendra Swamy Matha",
      templeNameKn: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ",
      addressLine1: "Line 1",
      addressLine2: "Line 2",
      registrationLine: null,
      photoLeftUrl: null,
      photoRightUrl: null,
      footerLine1: "Footer 1",
      footerLine2: "Footer 2",
      footerBlessing: "Blessing",
      printGotra: true,
      printNakshatra: true,
      printRashi: false,
      // A row without the paper columns reads as the A5 default (plan A4S-7).
      paperSize: "a5",
      paperCustomWidthMm: null,
      paperCustomHeightMm: null,
    });

    const saved = await putTemplate(req("PUT", "settings/template", { footerLine1: "New footer", printRashi: true }));
    expect(saved.status).toBe(200);
    expect(mockCallRpc).toHaveBeenCalledWith("seva_update_settings", {
      p_patch: { footer_line1: "New footer", print_rashi: true },
      p_staff_id: "s-admin",
    });

    const wrongPage = await putTemplate(req("PUT", "settings/template", { cancelWindowMinutes: 10 }));
    expect(wrongPage.status).toBe(400);
    expect(mockCallRpc).toHaveBeenCalledTimes(1);

    // The receipt paper is a template setting (plan A4S-7); a landscape custom size never reaches the database.
    const paper = await putTemplate(
      req("PUT", "settings/template", { paperSize: "custom", paperCustomWidthMm: 100, paperCustomHeightMm: 150 }),
    );
    expect(paper.status).toBe(200);
    expect(mockCallRpc).toHaveBeenLastCalledWith("seva_update_settings", {
      p_patch: { paper_size: "custom", paper_custom_w_mm: 100, paper_custom_h_mm: 150 },
      p_staff_id: "s-admin",
    });
    const landscape = await putTemplate(
      req("PUT", "settings/template", { paperSize: "custom", paperCustomWidthMm: 200, paperCustomHeightMm: 150 }),
    );
    expect(landscape.status).toBe(400);
    expect(mockCallRpc).toHaveBeenCalledTimes(2);
  });

  it("reads and saves the counter rules without the two always-required switches", async () => {
    const read = await getRules(req("GET", "settings/rules"));
    expect(read.status).toBe(200);
    const rules = (await read.json()) as Record<string, unknown>;
    expect(rules).toEqual({
      cancelWindowMinutes: 30,
      counterDaysAhead: 365,
      onlineDaysAhead: 90,
      onlineSameDayCutoff: "12:00",
      prasadamUndoSeconds: 120,
      dayCloseFlagThresholdPaise: 5000,
      tallyCashLedger: "Cash",
      tallyUpiLedger: "Bank - UPI",
      tallyOnlineLedger: "Gateway clearing",
      tallyColumns: null,
    });
    expect(rules).not.toHaveProperty("amountChangeReasonRequired");
    expect(rules).not.toHaveProperty("cashDifferenceNoteRequired");

    const saved = await putRules(req("PUT", "settings/rules", { cancelWindowMinutes: 20, dayCloseFlagThresholdPaise: 10050 }));
    expect(saved.status).toBe(200);
    expect(mockCallRpc).toHaveBeenCalledWith("seva_update_settings", {
      p_patch: { cancel_window_minutes: 20, day_close_flag_threshold: "100.50" },
      p_staff_id: "s-admin",
    });
  });

  it("never accepts the amount-change reason or cash-difference note switches", async () => {
    for (const patch of [{ amountChangeReasonRequired: false }, { cashDifferenceNoteRequired: false }]) {
      expect(settingsPatchSchema.safeParse(patch).success).toBe(false);
      expect(settingsPatchSchema.safeParse({ cancelWindowMinutes: 20, ...patch }).success).toBe(false);
      const response = await putRules(req("PUT", "settings/rules", { cancelWindowMinutes: 20, ...patch }));
      expect(response.status).toBe(400);
      expect(await errorCode(response)).toBe("validation");
    }
    expect(mockCallRpc).not.toHaveBeenCalled();
  });

  it("refuses a denomination above Rs 2,000 or of an unknown kind", async () => {
    const tooBig = await putDenominations(
      req("PUT", "settings/denominations", { items: [{ kind: "note", valuePaise: 500000, displayOrder: 1, shown: true }] }),
    );
    expect(tooBig.status).toBe(400);
    expect(await errorCode(tooBig)).toBe("validation");
    const unknownKind = await putDenominations(
      req("PUT", "settings/denominations", { items: [{ kind: "cheque", valuePaise: 10000, displayOrder: 1, shown: true }] }),
    );
    expect(unknownKind.status).toBe(400);
    expect(mockCallRpc).not.toHaveBeenCalled();

    const ok = await putDenominations(
      req("PUT", "settings/denominations", {
        items: [
          { kind: "coin", valuePaise: 1000, displayOrder: 2, shown: true },
          { kind: "note", valuePaise: 200000, displayOrder: 1, shown: false },
        ],
      }),
    );
    expect(ok.status).toBe(200);
    expect(mockCallRpc).toHaveBeenCalledWith("seva_save_denominations", {
      p_rows: [
        { kind: "note", value: "2000.00", shown: false },
        { kind: "coin", value: "10.00", shown: true },
      ],
      p_staff_id: "s-admin",
    });

    mockTables.cash_denominations = [{ kind: "note", value: 500, display_order: 1, shown: true }];
    expect(await (await getDenominations(req("GET", "settings/denominations"))).json()).toEqual({
      items: [{ kind: "note", valuePaise: 50000, displayOrder: 1, shown: true }],
    });
  });

  it("saves festivals with their dates", async () => {
    mockCallRpc.mockResolvedValueOnce(FESTIVAL_ID);
    const created = await postFestival(
      req("POST", "settings/festivals", { nameEn: "Aradhane", nameKn: null, active: true, dates: ["2026-08-20", "2026-08-21"] }),
    );
    expect(created.status).toBe(200);
    expect(await created.json()).toEqual({ id: FESTIVAL_ID });
    expect(mockCallRpc).toHaveBeenCalledWith("seva_save_festival", {
      p_festival: { name_en: "Aradhane", name_kn: null, active: true, days: ["2026-08-20", "2026-08-21"] },
      p_staff_id: "s-admin",
    });

    mockCallRpc.mockResolvedValueOnce(FESTIVAL_ID);
    const updated = await putFestival(
      req("PUT", `settings/festivals/${FESTIVAL_ID}`, { nameEn: "Aradhane", nameKn: null, active: false, dates: ["2026-08-20"] }),
      idParams(FESTIVAL_ID),
    );
    expect(updated.status).toBe(200);
    expect((mockCallRpc.mock.calls[1] as [string, { p_festival: Row }])[1].p_festival.id).toBe(FESTIVAL_ID);

    mockTables.festival_days = [
      { id: FESTIVAL_ID, name_en: "Aradhane", name_kn: null, active: true, festival_day_dates: [{ day: "2026-08-21" }, { day: "2026-08-20" }] },
    ];
    expect(await (await getFestivals(req("GET", "settings/festivals"))).json()).toEqual({
      festivals: [{ id: FESTIVAL_ID, nameEn: "Aradhane", nameKn: null, active: true, dates: ["2026-08-20", "2026-08-21"] }],
    });
  });

  it("adding a counter returns its new C and OF series", async () => {
    mockCallRpc.mockResolvedValueOnce(2);
    const response = await postCounter(req("POST", "settings/counters", { name: "Counter 2", place: "Front hall" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 2, onlineSeries: "C2", offlineSeries: "OF2" });
    expect(mockCallRpc).toHaveBeenCalledWith("seva_add_counter", { p_name: "Counter 2", p_place: "Front hall", p_staff_id: "s-admin" });

    mockTables.counters = [{ id: 1, name: "Counter 1", place: "Office PC", opening_float: 500, active: true }];
    mockTables.receipt_series = [
      { code: "C1", kind: "counter_online", counter_id: 1 },
      { code: "OF1", kind: "counter_offline", counter_id: 1 },
      { code: "W", kind: "online", counter_id: null },
    ];
    expect(await (await getCounters(req("GET", "settings/counters"))).json()).toEqual({
      counters: [{ id: 1, name: "Counter 1", place: "Office PC", openingFloatPaise: 50000, active: true, onlineSeries: "C1", offlineSeries: "OF1" }],
    });

    const changed = await putCounter(req("PUT", "settings/counters/1", { openingFloatPaise: 100000 }), idParams("1"));
    expect(changed.status).toBe(200);
    expect(mockCallRpc).toHaveBeenLastCalledWith("seva_update_counter", {
      p_counter_id: 1,
      p_patch: { opening_float: "1000.00" },
      p_staff_id: "s-admin",
    });
    const badId = await putCounter(req("PUT", "settings/counters/x", { active: false }), idParams("x"));
    expect(badId.status).toBe(400);
  });

  it("refuses view-only temple admins on every write", async () => {
    mockGuard.actor = VIEWER;
    expect((await getTemplate(req("GET", "settings/template"))).status).toBe(200);
    const writes = [
      await putTemplate(req("PUT", "settings/template", { footerLine1: "x" })),
      await putRules(req("PUT", "settings/rules", { cancelWindowMinutes: 10 })),
      await putDenominations(req("PUT", "settings/denominations", { items: [{ kind: "note", valuePaise: 50000, displayOrder: 1, shown: true }] })),
      await postFestival(req("POST", "settings/festivals", { nameEn: "A", nameKn: null, active: true, dates: ["2026-08-20"] })),
      await putFestival(
        req("PUT", `settings/festivals/${FESTIVAL_ID}`, { nameEn: "A", nameKn: null, active: true, dates: ["2026-08-20"] }),
        idParams(FESTIVAL_ID),
      ),
      await postCounter(req("POST", "settings/counters", { name: "C", place: null })),
      await putCounter(req("PUT", "settings/counters/1", { active: false }), idParams("1")),
    ];
    for (const response of writes) {
      expect(response.status).toBe(403);
      expect(await errorCode(response)).toBe("view_only");
    }
    expect(mockCallRpc).not.toHaveBeenCalled();
  });

  it("keeps settings away from receptionists", async () => {
    mockGuard.actor = RECEPTIONIST;
    expect((await getRules(req("GET", "settings/rules"))).status).toBe(403);
    expect((await putRules(req("PUT", "settings/rules", { cancelWindowMinutes: 10 }))).status).toBe(403);
    expect(mockCallRpc).not.toHaveBeenCalled();
  });
});
