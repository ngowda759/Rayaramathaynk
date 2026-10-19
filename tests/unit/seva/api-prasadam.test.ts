/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import type { SevaActor } from "@/lib/seva/permissions";
import { addDays, businessDate, istParts } from "@/lib/seva/time";
import type { PrasadamLookupResult } from "@/types/seva-prasadam";

jest.mock("server-only", () => ({}), { virtual: true });

// ---- Supabase: records every query and answers from mockAnswer --------------------------------------------------
type Row = Record<string, unknown>;
interface Call {
  table: string;
  columns: string;
  ops: unknown[][];
}
const mockCalls: Call[] = [];
let mockAnswer: (call: Call) => Row[] = () => [];

function mockSupabase() {
  return {
    from(table: string) {
      const call: Call = { table, columns: "", ops: [] };
      mockCalls.push(call);
      const builder: Record<string, unknown> = {};
      for (const op of ["eq", "neq", "in", "gte", "lte", "ilike", "or", "order", "limit"]) {
        builder[op] = (...args: unknown[]) => {
          call.ops.push([op, ...args]);
          return builder;
        };
      }
      builder.select = (columns: string) => {
        call.columns = columns;
        return builder;
      };
      builder.maybeSingle = () => Promise.resolve({ data: mockAnswer(call)[0] ?? null, error: null });
      builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve({ data: mockAnswer(call), error: null }).then(resolve, reject);
      return builder;
    },
  };
}
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockSupabase() }));

const mockRequireSevaActor = jest.fn();
jest.mock("@/lib/seva/server/auth", () => ({
  SEVA_DEVICE_HEADER: "x-seva-device",
  requireSevaActor: (...args: unknown[]) => mockRequireSevaActor(...args),
}));
const mockCallRpc = jest.fn();
jest.mock("@/lib/seva/server/rpc", () => ({ callRpc: (...args: unknown[]) => mockCallRpc(...args) }));

import { GET as lookupGET } from "@/app/api/seva/prasadam/lookup/route";
import { POST as givePOST } from "@/app/api/seva/prasadam/give/route";
import { POST as undoPOST } from "@/app/api/seva/prasadam/undo/route";

const RECEIPT_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_ID = "22222222-2222-4222-8222-222222222222";
const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUv";

function actor(role: SevaActor["role"], staffId = "staff-5"): SevaActor {
  return { staffId, uid: `uid-${staffId}`, role, viewOnly: false, staffNo: 5, name: "Suresh" };
}

function allow(a: SevaActor) {
  return { ok: true as const, actor: a, device: null };
}

function get(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

function post(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function has(call: Call | undefined, ...op: unknown[]): boolean {
  return !!call && call.ops.some((o) => JSON.stringify(o) === JSON.stringify(op));
}

const today = () => businessDate(new Date());

function receiptRow(overrides: Row = {}): Row {
  return {
    id: RECEIPT_ID,
    receipt_no: "C1-023-10-2026/000124",
    seva_date: today(),
    issued_at: "2026-10-19T05:30:00+00:00",
    status: "issued",
    prasadam_state: "pending",
    prasadam_given_at: null,
    prasadam_given_by_staff_id: null,
    cancelled_at: null,
    cancelled_by_staff_id: null,
    cancel_reason_code: null,
    cancel_note: null,
    position: 1,
    order_id: ORDER_ID,
    total: 610,
    seva_orders: { devotee_name: "Venkatesh Rao", group_no: "G-2610-0042", receipts_count: 1, amount_total: 610 },
    lines: [{ line_no: 1, seva_name_en: "Paaduka Pooja", seva_name_kn: "ಪಾದುಕಾ ಪೂಜೆ", quantity: 2, prasadam_items: "Laddu", amount: 610 }],
    ...overrides,
  };
}

/** Answers the receipt lookup with `receipts`, the same-group lookup with `siblings`, staff names and settings. */
function answers(receipts: Row[], extra: { siblings?: Row[]; staff?: Row[]; settings?: Row } = {}) {
  mockAnswer = (call) => {
    if (call.table === "seva_receipts") return call.ops.some((o) => o[1] === "order_id") ? extra.siblings ?? [] : receipts;
    if (call.table === "staff") return extra.staff ?? [];
    if (call.table === "seva_settings") return [extra.settings ?? { cancel_window_minutes: 30, prasadam_undo_seconds: 120 }];
    return [];
  };
}

async function lookup(q: string): Promise<PrasadamLookupResult> {
  const res = await lookupGET(get(`/api/seva/prasadam/lookup?q=${encodeURIComponent(q)}`));
  expect(res.status).toBe(200);
  return (await res.json()) as PrasadamLookupResult;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCalls.length = 0;
  mockAnswer = () => [];
  mockRequireSevaActor.mockResolvedValue(allow(actor("prasadam_counter")));
});

describe("GET /api/seva/prasadam/lookup", () => {
  it("lookup resolves a scanner-typed URL with a trailing new line", async () => {
    answers([receiptRow()]);
    const result = await lookup(`https://x/r/${TOKEN}\n`);

    expect(mockRequireSevaActor).toHaveBeenCalledWith(expect.anything(), "prasadam.give");
    expect(has(mockCalls.find((c) => c.table === "seva_receipts"), "eq", "qr_token", TOKEN)).toBe(true);
    expect(result).toEqual({
      state: "ready",
      receipt: {
        id: RECEIPT_ID,
        receiptNo: "C1-023-10-2026/000124",
        devoteeName: "Venkatesh Rao",
        sevaDate: today(),
        issuedAt: "2026-10-19T05:30:00+00:00",
        groupLine: null,
        lines: [{ nameEn: "Paaduka Pooja", nameKn: "ಪಾದುಕಾ ಪೂಜೆ", quantity: 2, prasadamItems: "Laddu" }],
      },
    });
  });

  it("short form matching two series returns a choose list", async () => {
    answers([
      receiptRow({ id: SECOND_ID, receipt_no: "OF1-023-10-2026/000124", seva_date: "2026-10-18" }),
      receiptRow(),
    ]);
    const result = await lookup("124");

    const query = mockCalls.find((c) => c.table === "seva_receipts");
    expect(has(query, "eq", "running_no", 124)).toBe(true);
    expect(has(query, "eq", "year", istParts(new Date()).year)).toBe(true);
    expect(query?.ops.some((o) => o[1] === "series_code")).toBe(false);
    expect(result).toEqual({
      state: "choose",
      options: [
        { receiptId: RECEIPT_ID, receiptNo: "C1-023-10-2026/000124", sevaDate: today(), devoteeName: "Venkatesh Rao" },
        { receiptId: SECOND_ID, receiptNo: "OF1-023-10-2026/000124", sevaDate: "2026-10-18", devoteeName: "Venkatesh Rao" },
      ],
    });
  });

  it("reads a spaced, lower-case short form with its series", async () => {
    answers([receiptRow()]);
    const result = await lookup(" c1 124 ");
    const query = mockCalls.find((c) => c.table === "seva_receipts");
    expect(has(query, "eq", "series_code", "C1")).toBe(true);
    expect(result.state).toBe("ready");
  });

  it("lookup answers carry no amounts", async () => {
    answers([receiptRow({ seva_date: addDays(today(), 2), position: 2 })], {
      siblings: [{ receipt_no: "C1-023-10-2026/000123", position: 1 }],
    });
    const result = await lookup("C1-023-10-2026/000124");
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/amount|total|Paise/i);
    const query = mockCalls.find((c) => c.table === "seva_receipts");
    expect(query?.columns).not.toMatch(/amount|total|phone/);
  });

  it("maps each SQL prasadam state to its screen state", async () => {
    // ready
    answers([receiptRow()]);
    expect((await lookup(TOKEN)).state).toBe("ready");

    // another day: the seva is two days ahead; today's slip of the same group is named
    answers(
      [receiptRow({ seva_date: addDays(today(), 2), position: 2, seva_orders: { devotee_name: "Venkatesh Rao", group_no: "G-2610-0042", receipts_count: 3 } })],
      { siblings: [{ receipt_no: "C1-023-10-2026/000123", position: 1 }] },
    );
    const another = await lookup(TOKEN);
    expect(another).toMatchObject({
      state: "another_day",
      offDate: "before",
      days: 2,
      todaysSlip: { receiptNo: "C1-023-10-2026/000123", position: 1, count: 3 },
      receipt: { groupLine: "2 of 3 · paid together · group G-2610-0042" },
    });
    const siblings = mockCalls.filter((c) => c.table === "seva_receipts").pop();
    expect(has(siblings, "eq", "order_id", ORDER_ID)).toBe(true);
    expect(has(siblings, "eq", "seva_date", today())).toBe(true);
    expect(has(siblings, "eq", "status", "issued")).toBe(true);

    // already given
    answers(
      [receiptRow({ prasadam_state: "given", prasadam_given_at: "2026-10-19T05:35:00+00:00", prasadam_given_by_staff_id: "staff-7" })],
      { staff: [{ id: "staff-7", full_name: "Suresh" }] },
    );
    expect(await lookup(TOKEN)).toMatchObject({ state: "already_given", givenAt: "2026-10-19T05:35:00+00:00", givenBy: "Suresh" });

    // cancelled
    answers(
      [
        receiptRow({
          status: "cancelled",
          cancelled_at: "2026-10-19T05:40:00+00:00",
          cancelled_by_staff_id: "staff-1",
          cancel_reason_code: "spoiled_print",
          cancel_note: "Spoiled print; reissued as C1-023-10-2026/000125",
        }),
      ],
      { staff: [{ id: "staff-1", full_name: "Ravi" }] },
    );
    expect(await lookup(TOKEN)).toMatchObject({
      state: "cancelled",
      cancelledAt: "2026-10-19T05:40:00+00:00",
      cancelledBy: "Ravi",
      reason: "Spoiled print (paper jam or misprint)",
    });

    // no prasadam
    answers([receiptRow({ prasadam_state: "none" })]);
    expect((await lookup(TOKEN)).state).toBe("no_prasadam");

    // not found
    answers([]);
    expect(await lookup("C1-023-10-2026/009999")).toEqual({ state: "not_found", query: "C1-023-10-2026/009999" });
    expect(await lookup("hello")).toEqual({ state: "not_found", query: "hello" });
  });

  it("answers 400 when nothing was typed", async () => {
    const res = await lookupGET(get("/api/seva/prasadam/lookup?q=%20"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/seva/prasadam/give", () => {
  it("maps the SQL give answers to screen states", async () => {
    answers([receiptRow({ prasadam_state: "given", prasadam_given_at: "2026-10-19T05:50:00+00:00", prasadam_given_by_staff_id: "staff-5" })]);
    mockCallRpc.mockResolvedValueOnce({ state: "given", given_at: "2026-10-19T05:50:00+00:00", given_by_name: "Suresh" });
    const given = await givePOST(post("/api/seva/prasadam/give", { receiptId: RECEIPT_ID, confirmOffDate: false }));
    expect(mockRequireSevaActor).toHaveBeenLastCalledWith(expect.anything(), "prasadam.give");
    expect(mockCallRpc).toHaveBeenLastCalledWith("seva_mark_prasadam", {
      p_receipt_id: RECEIPT_ID,
      p_staff_id: "staff-5",
      p_confirm_off_date: false,
    });
    expect(await given.json()).toMatchObject({ state: "already_given", givenAt: "2026-10-19T05:50:00+00:00", givenBy: "Suresh" });

    answers([receiptRow({ seva_date: addDays(today(), -1) })]);
    mockCallRpc.mockResolvedValueOnce({ state: "needs_confirm", off_date: "after", days: 1 });
    const confirm = await givePOST(post("/api/seva/prasadam/give", { receiptId: RECEIPT_ID, confirmOffDate: false }));
    expect(await confirm.json()).toMatchObject({ state: "another_day", offDate: "after", days: 1, todaysSlip: null });

    mockCallRpc.mockResolvedValueOnce({ state: "given", off_date: "after", days: 1, given_at: "2026-10-19T05:51:00+00:00", given_by_name: "Suresh" });
    await givePOST(post("/api/seva/prasadam/give", { receiptId: RECEIPT_ID, confirmOffDate: true }));
    expect(mockRequireSevaActor).toHaveBeenLastCalledWith(expect.anything(), "prasadam.give_off_date");

    mockCallRpc.mockRejectedValueOnce(new (jest.requireActual<typeof import("@/lib/seva/errors")>("@/lib/seva/errors").SevaError)("not_found"));
    const missing = await givePOST(post("/api/seva/prasadam/give", { receiptId: SECOND_ID, confirmOffDate: false }));
    expect(await missing.json()).toEqual({ state: "not_found", query: SECOND_ID });
  });
});

describe("POST /api/seva/prasadam/undo", () => {
  const givenAgo = (seconds: number): Row =>
    receiptRow({
      prasadam_state: "given",
      prasadam_given_at: new Date(Date.now() - seconds * 1000).toISOString(),
      prasadam_given_by_staff_id: "staff-5",
    });

  it("undo after the undo time requires prasadam.reverse", async () => {
    mockCallRpc.mockResolvedValue({ state: "pending" });

    // The same person inside 120 s: allowed, not as an admin.
    answers([givenAgo(30)]);
    const quick = await undoPOST(post("/api/seva/prasadam/undo", { receiptId: RECEIPT_ID }));
    expect(quick.status).toBe(200);
    expect(mockCallRpc).toHaveBeenLastCalledWith("seva_undo_prasadam", {
      p_receipt_id: RECEIPT_ID,
      p_staff_id: "staff-5",
      p_reason: null,
      p_is_admin: false,
    });

    // The prasadam counter after the undo time: refused before the database is asked.
    mockCallRpc.mockClear();
    answers([givenAgo(600)]);
    const late = await undoPOST(post("/api/seva/prasadam/undo", { receiptId: RECEIPT_ID, reason: "Wrong person" }));
    expect(late.status).toBe(403);
    expect(await late.json()).toMatchObject({ error: { code: "forbidden" } });
    expect(mockCallRpc).not.toHaveBeenCalled();

    // A temple admin after the undo time: reversed as an admin, with the reason.
    mockRequireSevaActor.mockResolvedValue(allow(actor("temple_admin", "staff-2")));
    const admin = await undoPOST(post("/api/seva/prasadam/undo", { receiptId: RECEIPT_ID, reason: "Wrong person" }));
    expect(admin.status).toBe(200);
    expect(mockCallRpc).toHaveBeenLastCalledWith("seva_undo_prasadam", {
      p_receipt_id: RECEIPT_ID,
      p_staff_id: "staff-2",
      p_reason: "Wrong person",
      p_is_admin: true,
    });
  });

  it("passes through a refusal from the guard", async () => {
    mockRequireSevaActor.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: { code: "unauthenticated", message: "no" } }, { status: 401 }),
    });
    const res = await undoPOST(post("/api/seva/prasadam/undo", { receiptId: RECEIPT_ID }));
    expect(res.status).toBe(401);
    expect(mockCallRpc).not.toHaveBeenCalled();
  });
});
