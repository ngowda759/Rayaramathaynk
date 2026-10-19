/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import type { SevaActor } from "@/lib/seva/permissions";
import { businessDate } from "@/lib/seva/time";
import type { IssueResponse } from "@/types/seva";
import type { DevoteeMatch, ReceiptDetail, ReceiptListItem } from "@/types/seva-receipts";

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

// ---- The guard, the device check, the RPC wrapper and the SQL answer converter --------------------------------
const mockRequireSevaActor = jest.fn();
jest.mock("@/lib/seva/server/auth", () => ({
  SEVA_DEVICE_HEADER: "x-seva-device",
  requireSevaActor: (...args: unknown[]) => mockRequireSevaActor(...args),
}));
const mockVerifyDevice = jest.fn();
jest.mock("@/lib/seva/server/device", () => ({ verifyDeviceHeader: (...args: unknown[]) => mockVerifyDevice(...args) }));
const mockCallRpc = jest.fn();
jest.mock("@/lib/seva/server/rpc", () => ({ callRpc: (...args: unknown[]) => mockCallRpc(...args) }));
const mockFromSqlIssue = jest.fn();
jest.mock("@/lib/seva/server/counter", () => ({ fromSqlIssue: (...args: unknown[]) => mockFromSqlIssue(...args) }));

import { GET as listGET } from "@/app/api/seva/receipts/route";
import { GET as detailGET } from "@/app/api/seva/receipts/[receiptId]/route";
import { POST as cancelPOST } from "@/app/api/seva/receipts/cancel/route";
import { POST as reissuePOST } from "@/app/api/seva/receipts/[receiptId]/reissue/route";
import { GET as searchGET } from "@/app/api/seva/devotees/search/route";
import { POST as gapPOST } from "@/app/api/seva/gaps/[id]/route";

const RECEIPT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const ORDER_ID = "33333333-3333-4333-8333-333333333333";

function actor(role: SevaActor["role"], staffId = "staff-1"): SevaActor {
  return { staffId, uid: `uid-${staffId}`, role, viewOnly: false, staffNo: 23, name: "Ravi" };
}

function allow(a: SevaActor, device: { id: string; counterId: number } | null = null) {
  return { ok: true as const, actor: a, device };
}

function deny(code: string, status = 403) {
  return { ok: false as const, response: NextResponse.json({ error: { code, message: "no" } }, { status }) };
}

function get(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost${path}`, { headers });
}

function post(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function params<T extends Record<string, string>>(value: T): { params: Promise<T> } {
  return { params: Promise.resolve(value) };
}

function has(call: Call | undefined, ...op: unknown[]): boolean {
  return !!call && call.ops.some((o) => JSON.stringify(o) === JSON.stringify(op));
}

function receiptRow(overrides: Row = {}): Row {
  return {
    id: RECEIPT_ID,
    receipt_no: "C1-023-10-2026/000124",
    series_code: "C1",
    business_date: "2026-10-19",
    issued_at: "2026-10-19T05:30:00.123456+00:00",
    total: 610,
    status: "issued",
    has_changed_amount: false,
    print_count: 1,
    prasadam_state: "pending",
    position: 1,
    issued_by_staff_id: "staff-1",
    refund_state: "none",
    phone_e164: "+919845012345",
    seva_orders: {
      devotee_name: "Venkatesh Rao",
      payment_mode: "cash",
      group_no: "G-2610-0042",
      receipts_count: 1,
      counter_id: 1,
      phone_e164: "+919845012345",
    },
    lines: [
      { line_no: 2, seva_name_en: "Archane", quantity: 1 },
      { line_no: 1, seva_name_en: "Paaduka Pooja", quantity: 2 },
    ],
    ...overrides,
  };
}

const settingsRow: Row = { cancel_window_minutes: 30, prasadam_undo_seconds: 120 };

function tableAnswers(tables: Record<string, Row[]>): (call: Call) => Row[] {
  return (call) => tables[call.table] ?? [];
}

let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockCalls.length = 0;
  mockAnswer = tableAnswers({ seva_settings: [settingsRow] });
  mockVerifyDevice.mockResolvedValue(null);
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("GET /api/seva/receipts", () => {
  it("limits a receptionist's list to their counter and today", async () => {
    const today = businessDate(new Date());
    mockVerifyDevice.mockResolvedValue({ id: "dev-1", counterId: 2 });
    mockRequireSevaActor.mockResolvedValue(allow(actor("receptionist"), { id: "dev-1", counterId: 2 }));
    mockAnswer = tableAnswers({ seva_settings: [settingsRow], seva_receipts: [receiptRow()] });

    const res = await listGET(get("/api/seva/receipts?from=2026-01-01&to=2026-12-31", { "x-seva-device": "dev-1.secret" }));

    expect(res.status).toBe(200);
    expect(mockVerifyDevice).toHaveBeenCalledWith("dev-1.secret");
    expect(mockRequireSevaActor).toHaveBeenCalledWith(expect.anything(), "receipts.list", {
      device: "optional",
      ctx: { receiptCounterId: 2, receiptBusinessDate: today },
    });
    const query = mockCalls.find((c) => c.table === "seva_receipts");
    expect(has(query, "eq", "seva_orders.counter_id", 2)).toBe(true);
    expect(has(query, "eq", "business_date", today)).toBe(true);
    expect(has(query, "gte", "business_date", "2026-01-01")).toBe(false);
    expect(has(query, "eq", "test_mode", false)).toBe(true);
  });

  it("lets a temple admin filter every counter by date, status and search", async () => {
    mockRequireSevaActor.mockResolvedValue(allow(actor("temple_admin")));
    mockAnswer = tableAnswers({ seva_settings: [settingsRow], seva_receipts: [receiptRow()] });

    const res = await listGET(get("/api/seva/receipts?from=2026-10-01&to=2026-10-19&status=cancelled&q=C1%20124"));
    const body = (await res.json()) as { rows: ReceiptListItem[]; nextCursor: string | null };

    expect(res.status).toBe(200);
    const query = mockCalls.find((c) => c.table === "seva_receipts");
    expect(query?.ops.some((o) => o[1] === "seva_orders.counter_id")).toBe(false);
    expect(has(query, "gte", "business_date", "2026-10-01")).toBe(true);
    expect(has(query, "lte", "business_date", "2026-10-19")).toBe(true);
    expect(has(query, "eq", "status", "cancelled")).toBe(true);
    expect(has(query, "eq", "series_code", "C1")).toBe(true);
    expect(has(query, "eq", "running_no", 124)).toBe(true);
    expect(body.rows[0]).toMatchObject({
      receiptNo: "C1-023-10-2026/000124",
      devoteeName: "Venkatesh Rao",
      sevas: "Paaduka Pooja x2, Archane",
      totalPaise: 61000,
      mode: "cash",
      cancelDeadline: "2026-10-19T06:00:00.123Z",
    });
    expect(body.nextCursor).toBeNull();
  });

  it("answers 400 validation for a bad filter", async () => {
    mockRequireSevaActor.mockResolvedValue(allow(actor("temple_admin")));
    const res = await listGET(get("/api/seva/receipts?status=lost"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "validation", detail: { field: "status" } } });
  });

  it("passes through the guard response", async () => {
    mockRequireSevaActor.mockResolvedValue(deny("unauthenticated", 401));
    const res = await listGET(get("/api/seva/receipts"));
    expect(res.status).toBe(401);
    expect(mockCalls.some((c) => c.table === "seva_receipts")).toBe(false);
  });
});

describe("phone numbers", () => {
  it("never returns phone numbers in lists or search", async () => {
    mockRequireSevaActor.mockResolvedValue(allow(actor("temple_admin")));
    mockAnswer = tableAnswers({
      seva_settings: [settingsRow],
      seva_receipts: [receiptRow()],
      devotee_profiles: [
        {
          name: "Venkatesh Rao",
          gotra: "Bharadwaja",
          gotra_id: 2,
          nakshatra_id: 4,
          rashi_id: null,
          phone_e164: "+919845012345",
          last_seen_at: "2026-09-12T05:00:00+00:00",
        },
      ],
    });

    const list = (await (await listGET(get("/api/seva/receipts"))).json()) as { rows: ReceiptListItem[] };
    const search = (await (await searchGET(get("/api/seva/devotees/search?name=Venk"))).json()) as {
      matches: DevoteeMatch[];
    };

    for (const row of [...list.rows, ...search.matches]) {
      expect(Object.keys(row)).not.toContain("phone");
      expect(Object.keys(row)).not.toContain("phone_e164");
    }
    expect(JSON.stringify(list)).not.toContain("9845012345");
    expect(JSON.stringify(search)).not.toContain("9845012345");
    const receiptsQuery = mockCalls.find((c) => c.table === "seva_receipts");
    expect(receiptsQuery?.columns).not.toContain("phone");
  });
});

describe("GET /api/seva/devotees/search", () => {
  it("search returns at most five matches with the last four digits only", async () => {
    mockRequireSevaActor.mockResolvedValue(allow(actor("receptionist")));
    mockAnswer = tableAnswers({
      devotee_profiles: Array.from({ length: 7 }, (_, i) => ({
        name: `Rao ${i}`,
        gotra: null,
        gotra_id: null,
        nakshatra_id: null,
        rashi_id: null,
        phone_e164: `+91984501234${i}`,
        last_seen_at: "2026-09-12T05:00:00+00:00",
      })),
    });

    const res = await searchGET(get("/api/seva/devotees/search?phone=98450%2012340"));
    const body = (await res.json()) as { matches: DevoteeMatch[] };

    expect(res.status).toBe(200);
    expect(mockRequireSevaActor).toHaveBeenCalledWith(expect.anything(), "devotees.search");
    const query = mockCalls.find((c) => c.table === "devotee_profiles");
    expect(has(query, "eq", "phone_e164", "+919845012340")).toBe(true);
    expect(has(query, "limit", 5)).toBe(true);
    expect(body.matches).toHaveLength(5);
    expect(body.matches[0]).toEqual({
      name: "Rao 0",
      gotra: null,
      gotraId: null,
      nakshatraId: null,
      rashiId: null,
      phoneLast4: "2340",
      lastVisit: "2026-09-12T05:00:00+00:00",
    });
  });

  it("refuses a name shorter than three letters", async () => {
    mockRequireSevaActor.mockResolvedValue(allow(actor("receptionist")));
    const res = await searchGET(get("/api/seva/devotees/search?name=Ra"));
    expect(res.status).toBe(400);
    expect(mockCalls.some((c) => c.table === "devotee_profiles")).toBe(false);
  });
});

describe("POST /api/seva/receipts/cancel", () => {
  const ownRows = [{ id: RECEIPT_ID, issued_by_staff_id: "staff-9", issued_at: new Date().toISOString() }];
  /** The ownership read gets ownRows; the register rows read after the cancel get a full row. */
  const cancelAnswers = (call: Call): Row[] => {
    if (call.table === "seva_settings") return [settingsRow];
    if (call.table !== "seva_receipts") return [];
    return call.columns.includes("seva_orders") ? [receiptRow({ status: "cancelled", refund_state: "done" })] : ownRows;
  };

  it("cancel passes p_is_admin from the actor's rights", async () => {
    mockAnswer = cancelAnswers;
    mockCallRpc.mockResolvedValue({ receipts: [], cash_back: "0.00" });

    // A receptionist's own receipt inside the window: one guard call, p_is_admin false.
    mockRequireSevaActor.mockResolvedValueOnce(allow(actor("receptionist", "staff-9")));
    const own = await cancelPOST(post("/api/seva/receipts/cancel", { receiptIds: [RECEIPT_ID], reasonCode: "wrong_seva" }));
    expect(own.status).toBe(200);
    expect(mockRequireSevaActor).toHaveBeenCalledWith(expect.anything(), "receipt.cancel_own", {
      device: "optional",
      ctx: { receiptIssuedByStaffId: "staff-9", withinCancelWindow: true },
    });
    expect(await own.json()).toMatchObject({ receipts: [{ id: RECEIPT_ID, status: "cancelled", refundState: "done" }] });
    expect(mockCallRpc).toHaveBeenLastCalledWith("seva_cancel_receipts", {
      p_receipt_ids: [RECEIPT_ID],
      p_reason_code: "wrong_seva",
      p_note: null,
      p_staff_id: "staff-9",
      p_is_admin: false,
    });

    // A temple admin cancelling someone else's receipt: cancel_own is refused, cancel_any lets it through.
    mockRequireSevaActor.mockReset();
    mockRequireSevaActor
      .mockResolvedValueOnce(deny("forbidden"))
      .mockResolvedValueOnce(allow(actor("temple_admin", "staff-2")));
    const admin = await cancelPOST(
      post("/api/seva/receipts/cancel", { receiptIds: [RECEIPT_ID], reasonCode: "other", note: "Devotee left" }),
    );
    expect(admin.status).toBe(200);
    expect(mockRequireSevaActor).toHaveBeenLastCalledWith(expect.anything(), "receipt.cancel_any", { device: "optional" });
    expect(mockCallRpc).toHaveBeenLastCalledWith("seva_cancel_receipts", {
      p_receipt_ids: [RECEIPT_ID],
      p_reason_code: "other",
      p_note: "Devotee left",
      p_staff_id: "staff-2",
      p_is_admin: true,
    });
  });

  it("does not try the admin right when the first refusal is not about the role", async () => {
    mockAnswer = cancelAnswers;
    mockRequireSevaActor.mockResolvedValueOnce(deny("view_only"));
    const res = await cancelPOST(post("/api/seva/receipts/cancel", { receiptIds: [RECEIPT_ID], reasonCode: "wrong_seva" }));
    expect(res.status).toBe(403);
    expect(mockRequireSevaActor).toHaveBeenCalledTimes(1);
    expect(mockCallRpc).not.toHaveBeenCalled();
  });

  it("answers 400 validation when Other has no note", async () => {
    mockRequireSevaActor.mockResolvedValue(allow(actor("temple_admin")));
    const res = await cancelPOST(post("/api/seva/receipts/cancel", { receiptIds: [RECEIPT_ID], reasonCode: "other" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "validation", detail: { field: "note" } } });
    expect(mockCallRpc).not.toHaveBeenCalled();
  });

  it("answers the SQL business error with its code", async () => {
    const { SevaError } = jest.requireActual<typeof import("@/lib/seva/errors")>("@/lib/seva/errors");
    mockAnswer = cancelAnswers;
    mockRequireSevaActor.mockResolvedValue(allow(actor("receptionist", "staff-9")));
    mockCallRpc.mockRejectedValue(new SevaError("cancel_window_passed"));
    const res = await cancelPOST(post("/api/seva/receipts/cancel", { receiptIds: [RECEIPT_ID], reasonCode: "wrong_seva" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: "cancel_window_passed" } });
  });
});

describe("POST /api/seva/receipts/[receiptId]/reissue", () => {
  it("reissue sends a fresh 22-character QR token", async () => {
    const converted: IssueResponse = { orderId: ORDER_ID, groupNo: "G-2610-0042", duplicate: false, receipts: [] };
    mockAnswer = tableAnswers({
      seva_settings: [settingsRow],
      seva_receipts: [{ id: RECEIPT_ID, issued_by_staff_id: "staff-9", issued_at: new Date().toISOString() }],
    });
    mockRequireSevaActor.mockResolvedValue(allow(actor("receptionist", "staff-9"), { id: "dev-1", counterId: 1 }));
    mockCallRpc.mockResolvedValue({ order_id: ORDER_ID });
    mockFromSqlIssue.mockReturnValue(converted);

    const first = await reissuePOST(post(`/api/seva/receipts/${RECEIPT_ID}/reissue`, {}), params({ receiptId: RECEIPT_ID }));
    await reissuePOST(post(`/api/seva/receipts/${RECEIPT_ID}/reissue`, {}), params({ receiptId: RECEIPT_ID }));

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual(converted);
    expect(mockRequireSevaActor).toHaveBeenCalledWith(expect.anything(), "receipt.cancel_own", {
      device: "required",
      ctx: { receiptIssuedByStaffId: "staff-9", withinCancelWindow: true },
    });
    const tokens = mockCallRpc.mock.calls.map((call) => (call[1] as { p_qr_token: string }).p_qr_token);
    expect(mockCallRpc.mock.calls[0][0]).toBe("seva_reissue_spoiled");
    expect(mockCallRpc.mock.calls[0][1]).toMatchObject({ p_receipt_id: RECEIPT_ID, p_staff_id: "staff-9", p_device_id: "dev-1" });
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(tokens[0]).not.toBe(tokens[1]);
    expect(mockFromSqlIssue).toHaveBeenCalledWith({ order_id: ORDER_ID });
  });

  it("answers 400 for a receipt id that is not a uuid", async () => {
    const res = await reissuePOST(post("/api/seva/receipts/abc/reissue", {}), params({ receiptId: "abc" }));
    expect(res.status).toBe(400);
    expect(mockRequireSevaActor).not.toHaveBeenCalled();
  });
});

describe("GET /api/seva/receipts/[receiptId]", () => {
  const facts: Row = {
    id: RECEIPT_ID,
    order_id: ORDER_ID,
    business_date: "2026-10-19",
    issued_at: "2026-10-19T05:30:00+00:00",
    issued_by_staff_id: "staff-1",
    issued_by_name: "Ravi",
    status: "cancelled",
    cancelled_at: "2026-10-19T05:40:00+00:00",
    cancelled_by_staff_id: "staff-1",
    cancel_reason_code: "wrong_seva",
    cancel_note: null,
    refund_state: "done",
    first_printed_at: "2026-10-19T05:30:05+00:00",
    prasadam_given_at: null,
    prasadam_given_by_staff_id: null,
    seva_orders: { counter_id: 1 },
  };

  it("checks the receipt's counter and date and lists the history newest first", async () => {
    mockAnswer = tableAnswers({
      seva_receipts: [facts],
      audit_log: [
        { at: "2026-10-19T05:40:00+00:00", action: "receipt.cancel", actor_staff_id: "staff-1", reason: "wrong_seva" },
        { at: "2026-10-19T05:35:00+00:00", action: "receipt.reprint", actor_staff_id: "staff-1", reason: null },
      ],
      staff: [{ id: "staff-1", full_name: "Ravi" }],
    });
    mockRequireSevaActor.mockResolvedValue(allow(actor("temple_admin")));
    mockCallRpc.mockResolvedValue({ order_id: ORDER_ID });
    mockFromSqlIssue.mockReturnValue({
      orderId: ORDER_ID,
      groupNo: "G-2610-0042",
      duplicate: false,
      receipts: [{ id: RECEIPT_ID, receiptNo: "C1-023-10-2026/000124", status: "cancelled" }],
    });

    const res = await detailGET(get(`/api/seva/receipts/${RECEIPT_ID}`), params({ receiptId: RECEIPT_ID }));
    const body = (await res.json()) as ReceiptDetail;

    expect(res.status).toBe(200);
    expect(mockRequireSevaActor).toHaveBeenCalledWith(expect.anything(), "receipts.list", {
      device: "optional",
      ctx: { receiptCounterId: 1, receiptBusinessDate: "2026-10-19" },
    });
    expect(mockCallRpc).toHaveBeenCalledWith("seva_order_json", { p_order_id: ORDER_ID, p_duplicate: false });
    expect(body.receiptNo).toBe("C1-023-10-2026/000124");
    expect(body.history.map((h) => h.action)).toEqual(["receipt.cancel", "receipt.reprint", "receipt.print", "receipt.issue"]);
    expect(body.cancel).toEqual({ at: "2026-10-19T05:40:00+00:00", by: "Ravi", reasonCode: "wrong_seva", note: null });
    expect(body.refundState).toBe("done");
  });

  it("answers 404 for an unknown receipt only after the guard", async () => {
    mockRequireSevaActor.mockResolvedValue(allow(actor("temple_admin")));
    const res = await detailGET(get(`/api/seva/receipts/${OTHER_ID}`), params({ receiptId: OTHER_ID }));
    expect(res.status).toBe(404);
    expect(mockRequireSevaActor).toHaveBeenCalledWith(expect.anything(), "receipts.list", { device: "optional", ctx: {} });
  });
});

describe("POST /api/seva/gaps/[id]", () => {
  it("resolving a gap needs gap.resolve and a note", async () => {
    mockRequireSevaActor.mockResolvedValue(allow(actor("temple_admin", "staff-2")));
    mockCallRpc.mockResolvedValue(null);

    const missing = await gapPOST(post("/api/seva/gaps/7", { status: "declared_lost" }), params({ id: "7" }));
    expect(missing.status).toBe(400);
    expect(mockCallRpc).not.toHaveBeenCalled();

    const ok = await gapPOST(
      post("/api/seva/gaps/7", { status: "declared_lost", note: "Book lost in the rain" }),
      params({ id: "7" }),
    );
    expect(ok.status).toBe(200);
    expect(mockRequireSevaActor).toHaveBeenCalledWith(expect.anything(), "gap.resolve");
    expect(mockCallRpc).toHaveBeenCalledWith("seva_resolve_gap", {
      p_gap_id: 7,
      p_status: "declared_lost",
      p_note: "Book lost in the rain",
      p_staff_id: "staff-2",
    });
  });

  it("passes through a refusal from the guard", async () => {
    mockRequireSevaActor.mockResolvedValue(deny("forbidden"));
    const res = await gapPOST(post("/api/seva/gaps/7", { status: "declared_lost", note: "Lost" }), params({ id: "7" }));
    expect(res.status).toBe(403);
    expect(mockCallRpc).not.toHaveBeenCalled();
  });
});
