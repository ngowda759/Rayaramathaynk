/** @jest-environment node */
import { NextRequest, NextResponse } from "next/server";
import { SevaError } from "@/lib/seva/errors";
import { can } from "@/lib/seva/permissions";

jest.mock("server-only", () => ({}), { virtual: true });

const mockGuard = jest.fn();
jest.mock("@/lib/seva/server/auth", () => ({
  SEVA_DEVICE_HEADER: "x-seva-device",
  requireSevaActor: (...args: unknown[]) => mockGuard(...args),
}));

const mockRpc = jest.fn();
jest.mock("@/lib/seva/server/rpc", () => ({ callRpc: (...args: unknown[]) => mockRpc(...args) }));

const mockVerifyDevice = jest.fn();
jest.mock("@/lib/seva/server/device", () => ({ verifyDeviceHeader: (...args: unknown[]) => mockVerifyDevice(...args) }));

import { GET, POST } from "@/app/api/seva/day-close/route";
import { POST as REOPEN } from "@/app/api/seva/day-close/reopen/route";

const ACTOR = { staffId: "staff-r", uid: "u-r", role: "receptionist", viewOnly: false, staffNo: 23, name: "Ramesh" };
const DEVICE = { id: "11111111-2222-4333-8444-555555555555", counterId: 1 };
const NOW = new Date("2026-10-21T06:30:00.000Z"); // Wednesday 12:00 IST
const TODAY = "2026-10-21";

const SQL_PREP = {
  counter_id: 1,
  business_date: TODAY,
  status: "open",
  opening_float: "500.00",
  receipts: 3,
  cancelled: 1,
  changed: 0,
  cash_expected: "1110.00",
  upi_count: 1,
  upi_expected: "505.00",
  outbox_pending: 0,
  series_ranges: [
    { series: "C1", first: "C1-023-10-2026/000124", last: "C1-023-10-2026/000126", issued: 2, cancelled: 1, open_gaps: 0 },
  ],
  denominations: [
    { kind: "note", value: "500.00" },
    { kind: "coin", value: "1.00" },
  ],
};

function get(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost${path}`, { headers });
}

function post(path: string, body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
  jest.setSystemTime(NOW);
  mockGuard.mockResolvedValue({ ok: true, actor: ACTOR, device: DEVICE });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("day close routes", () => {
  it("limits a receptionist's day close to their counter and today", async () => {
    mockRpc.mockResolvedValue(SQL_PREP);

    // Prepare with an explicit counter and no date: the date is today in IST.
    const prep = await GET(get("/api/seva/day-close?counterId=1"));
    expect(prep.status).toBe(200);
    expect(mockGuard).toHaveBeenLastCalledWith(expect.any(NextRequest), "dayclose.close", {
      device: "optional",
      ctx: { receiptCounterId: 1, receiptBusinessDate: TODAY },
    });
    expect(mockRpc).toHaveBeenLastCalledWith("seva_prepare_day_close", { p_counter_id: 1, p_business_date: TODAY });

    // No counter given: the guard's verified device names the counter, after the sign-in is checked (A3 gate L-1).
    mockGuard.mockResolvedValueOnce({ ok: true, actor: ACTOR, device: { id: DEVICE.id, counterId: 2 } });
    await GET(get("/api/seva/day-close", { "x-seva-device": "dev.secret" }));
    expect(mockGuard).toHaveBeenLastCalledWith(expect.any(NextRequest), "dayclose.close", {
      device: "optional",
      counterFromDevice: true,
      ctx: { receiptBusinessDate: TODAY },
    });
    expect(mockRpc).toHaveBeenLastCalledWith("seva_prepare_day_close", { p_counter_id: 2, p_business_date: TODAY });
    // The route never reads the device header itself.
    expect(mockVerifyDevice).not.toHaveBeenCalled();

    // Close: the counter and the date of the body are what the guard judges.
    mockRpc.mockResolvedValue("dc-1");
    const closed = await POST(
      post("/api/seva/day-close", {
        counterId: 1,
        businessDate: "2026-10-20",
        counts: [{ kind: "note", valuePaise: 50000, count: 2 }],
        upiBankTotalPaise: 50500,
        note: "",
      }),
    );
    expect(mockGuard).toHaveBeenLastCalledWith(expect.any(NextRequest), "dayclose.close", {
      device: "optional",
      ctx: { receiptCounterId: 1, receiptBusinessDate: "2026-10-20" },
    });
    expect(closed.status).toBe(200);
    await expect(closed.json()).resolves.toEqual({ dayCloseId: "dc-1" });

    // With the real matrix, those contexts allow the own counter today only.
    const actor = { role: "receptionist" as const, viewOnly: false, staffId: "staff-r" };
    const base = { counterIdOfDevice: 1, todayBusinessDate: TODAY };
    expect(can(actor, "dayclose.close", { ...base, receiptCounterId: 1, receiptBusinessDate: TODAY })).toBe(true);
    expect(can(actor, "dayclose.close", { ...base, receiptCounterId: 2, receiptBusinessDate: TODAY })).toBe(false);
    expect(can(actor, "dayclose.close", { ...base, receiptCounterId: 1, receiptBusinessDate: "2026-10-20" })).toBe(false);
  });

  it("passes the guard's refusal through and touches nothing", async () => {
    mockGuard.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: { code: "forbidden", message: "x" } }, { status: 403 }),
    });
    const res = await POST(
      post("/api/seva/day-close", { counterId: 2, businessDate: TODAY, counts: [], upiBankTotalPaise: null }),
    );
    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("asks for a counter when none is given and no PC is registered", async () => {
    mockGuard.mockResolvedValue({ ok: true, actor: { ...ACTOR, role: "temple_admin" }, device: null });
    const res = await GET(get("/api/seva/day-close"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "validation" } });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("answers a caller who is not signed in before looking at any PC (A3 security gate L-1)", async () => {
    mockGuard.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: { code: "unauthenticated", message: "x" } }, { status: 401 }),
    });
    for (const headers of [{ "x-seva-device": "dev.secret" }, { "x-seva-device": "retired.secret" }, {}]) {
      const res = await GET(get("/api/seva/day-close", headers));
      expect(res.status).toBe(401);
    }
    expect(mockVerifyDevice).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("converts the prepared day to paise", async () => {
    mockRpc.mockResolvedValue(SQL_PREP);
    const res = await GET(get("/api/seva/day-close?counterId=1&date=2026-10-21"));
    await expect(res.json()).resolves.toEqual({
      counterId: 1,
      businessDate: TODAY,
      status: "open",
      openingFloatPaise: 50000,
      receipts: 3,
      cancelled: 1,
      changed: 0,
      cashExpectedPaise: 111000,
      upiCount: 1,
      upiExpectedPaise: 50500,
      outboxPending: 0,
      seriesRanges: [
        { series: "C1", first: "C1-023-10-2026/000124", last: "C1-023-10-2026/000126", issued: 2, cancelled: 1, openGaps: 0 },
      ],
      denominations: [
        { kind: "note", valuePaise: 50000 },
        { kind: "coin", valuePaise: 100 },
      ],
    });
  });

  it("sends the counts in rupees and the staff id to seva_close_day", async () => {
    mockRpc.mockResolvedValue("dc-9");
    await POST(
      post("/api/seva/day-close", {
        counterId: 1,
        businessDate: TODAY,
        counts: [
          { kind: "note", valuePaise: 50000, count: 2 },
          { kind: "coin", valuePaise: 100, count: 10 },
        ],
        upiBankTotalPaise: 50500,
        note: "  Short by ten  ",
      }),
    );
    expect(mockRpc).toHaveBeenCalledWith("seva_close_day", {
      p_counter_id: 1,
      p_business_date: TODAY,
      p_counts: [
        { kind: "note", value: 500, count: 2 },
        { kind: "coin", value: 1, count: 10 },
      ],
      p_upi_bank_total: "505.00",
      p_note: "Short by ten",
      p_staff_id: "staff-r",
    });
  });

  it("passes the counter-offline override only for an admin who asks for it (A5-FIX M-2)", async () => {
    mockRpc.mockResolvedValue("dc-9");
    const body = { counterId: 1, businessDate: TODAY, counts: [], upiBankTotalPaise: null, counterOfflineOk: true };

    await POST(post("/api/seva/day-close", body));
    expect(mockRpc).toHaveBeenLastCalledWith("seva_close_day", expect.not.objectContaining({ p_counter_offline_ok: true }));

    mockGuard.mockResolvedValueOnce({ ok: true, actor: { ...ACTOR, role: "temple_admin" }, device: null });
    await POST(post("/api/seva/day-close", body));
    expect(mockRpc).toHaveBeenLastCalledWith("seva_close_day", expect.objectContaining({ p_counter_offline_ok: true }));

    mockGuard.mockResolvedValueOnce({ ok: true, actor: { ...ACTOR, role: "temple_admin" }, device: null });
    await POST(post("/api/seva/day-close", { ...body, counterOfflineOk: undefined }));
    expect(mockRpc).toHaveBeenLastCalledWith("seva_close_day", expect.not.objectContaining({ p_counter_offline_ok: true }));
  });

  it("maps difference_note_required and outbox_not_empty to 400 and 409", async () => {
    const body = { counterId: 1, businessDate: TODAY, counts: [], upiBankTotalPaise: null };

    mockRpc.mockRejectedValueOnce(new SevaError("difference_note_required", { cash_difference: "-10.00" }));
    const noNote = await POST(post("/api/seva/day-close", body));
    expect(noNote.status).toBe(400);
    await expect(noNote.json()).resolves.toMatchObject({ error: { code: "difference_note_required" } });

    mockRpc.mockRejectedValueOnce(new SevaError("outbox_not_empty", { outbox_pending: 2 }));
    const waiting = await POST(post("/api/seva/day-close", body));
    expect(waiting.status).toBe(409);
    await expect(waiting.json()).resolves.toMatchObject({ error: { code: "outbox_not_empty" } });
  });

  it("answers 400 validation for a bad close body", async () => {
    const res = await POST(post("/api/seva/day-close", { counterId: "one", businessDate: "2026-13-40", counts: [] }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "validation" } });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("reopen needs dayclose.reopen and a reason", async () => {
    mockRpc.mockResolvedValue(null);
    const id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const res = await REOPEN(post("/api/seva/day-close/reopen", { dayCloseId: id, reason: "Counted again" }));
    expect(mockGuard).toHaveBeenCalledWith(expect.any(NextRequest), "dayclose.reopen");
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("seva_reopen_day", {
      p_day_close_id: id,
      p_reason: "Counted again",
      p_staff_id: "staff-r",
    });

    mockRpc.mockClear();
    const bad = await REOPEN(post("/api/seva/day-close/reopen", { dayCloseId: id, reason: "x" }));
    expect(bad.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
