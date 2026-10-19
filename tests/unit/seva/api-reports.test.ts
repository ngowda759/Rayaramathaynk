/** @jest-environment node */
import { NextRequest, NextResponse } from "next/server";
import { can } from "@/lib/seva/permissions";

jest.mock("server-only", () => ({}), { virtual: true });

const mockGuard = jest.fn();
jest.mock("@/lib/seva/server/auth", () => ({
  SEVA_DEVICE_HEADER: "x-seva-device",
  requireSevaActor: (...args: unknown[]) => mockGuard(...args),
}));

const mockRpc = jest.fn();
jest.mock("@/lib/seva/server/rpc", () => ({ callRpc: (...args: unknown[]) => mockRpc(...args) }));

/** Every query-builder call, and what each table answers. */
const mockCalls: { table: string; method: string; args: unknown[] }[] = [];
const mockTables: Record<string, { data: unknown; error: unknown }> = {};

function mockBuilder(table: string): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "gte", "lte", "lt", "gt", "in", "or", "order", "range", "limit", "not", "is"]) {
    builder[method] = (...args: unknown[]) => {
      mockCalls.push({ table, method, args });
      return builder;
    };
  }
  const answer = () => Promise.resolve(mockTables[table] ?? { data: [], error: null });
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => answer().then(resolve, reject);
  builder.maybeSingle = answer;
  return builder;
}

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => mockBuilder(table) }),
}));

import { GET as DASHBOARD } from "@/app/api/seva/reports/dashboard/route";
import { GET as CONTINUITY } from "@/app/api/seva/reports/continuity/route";
import { GET as SEVA_SUMMARY } from "@/app/api/seva/reports/seva-summary/route";
import { GET as FESTIVAL } from "@/app/api/seva/reports/festival/route";
import { GET as AUDIT } from "@/app/api/seva/reports/audit/route";
import { GET as DAY_CLOSES } from "@/app/api/seva/reports/day-closes/route";
import { GET as EXPORT } from "@/app/api/seva/reports/export/route";
import { POST as EXPORT_AUDIT } from "@/app/api/seva/reports/export/audit/route";

const ADMIN = { staffId: "staff-a", uid: "u-a", role: "temple_admin", viewOnly: false, staffNo: 2, name: "Admin" };
const NOW = new Date("2026-10-21T06:30:00.000Z"); // Wednesday 12:00 IST

const TOTALS = { total: "1115.00", receipts: 2, cash: "610.00", upi: "505.00", online: "0.00" };
const SQL_DASHBOARD = {
  as_of: "2026-10-21T06:30:00+00:00",
  bucket: "day",
  tiles: { ...TOTALS, prev: { total: "200.00", receipts: 1, cash: "200.00", upi: "0.00", online: "0.00" } },
  hero: {
    buckets: [{ key: "2026-10-19", label: "19 Oct", cash: "610.00", upi: "505.00", online: "0.00" }],
    prev: [{ key: "2026-10-19", total: "200.00" }],
  },
  top_sevas: [
    { seva_id: "s1", name_en: "Paaduka Pooja", name_kn: null, amount: "610.00", quantity: 1, prev_amount: "0.00" },
  ],
  mode: { cash: "610.00", upi: "505.00", online: "0.00" },
  rush: [{ dow: 1, hour: 10, count: 2 }],
  calendar: [{ date: "2026-10-19", total: "1115.00" }],
  festival_dates: ["2026-10-20"],
};
const SQL_ATTENTION = [
  { id: "number_gaps", level: "critical", count: 1, detail: { missing_numbers: 3 } },
  { id: "upi_refunds_due", level: "attention", count: 1, detail: { amount: "505.00" } },
];

function get(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

function refuse(): { ok: false; response: NextResponse } {
  return { ok: false, response: NextResponse.json({ error: { code: "forbidden", message: "x" } }, { status: 403 }) };
}

function receiptRow(n: number): Record<string, unknown> {
  return {
    id: `r${n}`,
    receipt_no: `C1-023-10-2026/${String(n).padStart(6, "0")}`,
    series_code: "C1",
    business_date: "2026-10-21",
    issued_at: "2026-10-21T04:30:00+00:00",
    total: "610.00",
    status: "issued",
    cancel_reason_code: null,
    cancel_note: null,
    prasadam_state: "pending",
    has_changed_amount: false,
    issued_by_name: "Ramesh",
    seva_orders: {
      devotee_name: "Venkatesh Rao",
      gotra: "Kashyapa",
      nakshatra_id: 4,
      nakshatra_text: null,
      rashi_id: null,
      rashi_text: null,
      payment_mode: "cash",
      upi_ref_last6: null,
    },
    seva_receipt_lines: [
      {
        line_no: 1,
        seva_code: "PP",
        seva_name_en: "Paaduka Pooja",
        quantity: 1,
        unit_rate: "610.00",
        amount: "610.00",
        sevas: { income_ledger: null },
      },
    ],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCalls.length = 0;
  for (const key of Object.keys(mockTables)) delete mockTables[key];
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
  jest.setSystemTime(NOW);
  mockGuard.mockResolvedValue({ ok: true, actor: ADMIN, device: null });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("report routes", () => {
  it("passes like-for-like IST bounds for the week to seva_dashboard", async () => {
    mockRpc.mockImplementation((fn: string) => Promise.resolve(fn === "seva_dashboard" ? SQL_DASHBOARD : SQL_ATTENTION));
    const res = await DASHBOARD(get("/api/seva/reports/dashboard?period=week"));
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("seva_dashboard", {
      p_from: "2026-10-18T18:30:00.000Z", // Monday 19 Oct 00:00 IST
      p_to: "2026-10-21T06:30:00.000Z",
      p_prev_from: "2026-10-11T18:30:00.000Z",
      p_prev_to: "2026-10-14T06:30:00.000Z",
      p_bucket: "day",
    });
    expect(mockRpc).toHaveBeenCalledWith("seva_needs_attention", {
      p_from: "2026-10-18T18:30:00.000Z",
      p_to: "2026-10-21T06:30:00.000Z",
      p_today: "2026-10-21",
    });
    const body = (await res.json()) as { data: Record<string, unknown>; attention: unknown[] };
    expect(body.data).toMatchObject({
      period: "week",
      asOf: "2026-10-21T06:30:00.000Z",
      tiles: {
        totalPaise: 111500,
        receipts: 2,
        cashPaise: 61000,
        upiPaise: 50500,
        onlinePaise: 0,
        prev: { totalPaise: 20000, receipts: 1, cashPaise: 20000, upiPaise: 0, onlinePaise: 0 },
      },
      hero: {
        buckets: [{ key: "2026-10-19", label: "19 Oct", cashPaise: 61000, upiPaise: 50500, onlinePaise: 0 }],
        prev: [{ key: "2026-10-19", totalPaise: 20000 }],
      },
      topSevas: [{ sevaId: "s1", nameEn: "Paaduka Pooja", nameKn: null, amountPaise: 61000, quantity: 1, prevAmountPaise: 0 }],
      mode: { cashPaise: 61000, upiPaise: 50500, onlinePaise: 0 },
      rush: [{ dow: 1, hour: 10, count: 2 }],
      calendar: [{ date: "2026-10-19", totalPaise: 111500 }],
      festivalDates: ["2026-10-20"],
    });
    expect(body.attention).toEqual([
      { id: "number_gaps", level: "critical", count: 1, detail: { missing_numbers: 3 } },
      { id: "upi_refunds_due", level: "attention", count: 1, detail: { amountPaise: 50500 } },
    ]);
  });

  it("caches the dashboard for 60 seconds privately", async () => {
    mockRpc.mockImplementation((fn: string) => Promise.resolve(fn === "seva_dashboard" ? SQL_DASHBOARD : SQL_ATTENTION));
    const res = await DASHBOARD(get("/api/seva/reports/dashboard?period=today"));
    expect(res.headers.get("cache-control")).toBe("private, max-age=60");

    const bad = await DASHBOARD(get("/api/seva/reports/dashboard?period=decade"));
    expect(bad.status).toBe(400);
  });

  it("refuses reports to receptionists and allows view-only temple admins", async () => {
    mockRpc.mockResolvedValue([]);
    const calls: [(req: NextRequest) => Promise<Response>, string][] = [
      [DASHBOARD, "/api/seva/reports/dashboard?period=today"],
      [CONTINUITY, "/api/seva/reports/continuity?from=2026-10-01&to=2026-10-21"],
      [SEVA_SUMMARY, "/api/seva/reports/seva-summary?from=2026-10-01&to=2026-10-21"],
      [FESTIVAL, "/api/seva/reports/festival?festivalId=aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee&compareYear=2025"],
      [AUDIT, "/api/seva/reports/audit"],
      [DAY_CLOSES, "/api/seva/reports/day-closes?from=2026-10-01&to=2026-10-21"],
    ];
    for (const [handler, path] of calls) {
      mockGuard.mockClear();
      mockGuard.mockResolvedValueOnce(refuse());
      const res = await handler(get(path));
      expect(res.status).toBe(403);
      expect(mockGuard).toHaveBeenCalledWith(expect.any(NextRequest), "reports.view");
    }
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockCalls).toEqual([]);

    // The matrix behind the guard: receptionists and the prasadam counter no, view-only temple admins yes.
    expect(can({ role: "receptionist", viewOnly: false, staffId: "r" }, "reports.view")).toBe(false);
    expect(can({ role: "prasadam_counter", viewOnly: false, staffId: "p" }, "reports.view")).toBe(false);
    expect(can({ role: "temple_admin", viewOnly: true, staffId: "t" }, "reports.view")).toBe(true);
  });

  it("refuses phone numbers in exports without export.with_phones", async () => {
    mockGuard.mockResolvedValueOnce(refuse());
    const refused = await EXPORT(get("/api/seva/reports/export?part=receipts&from=2026-10-01&to=2026-10-21&includePhones=true"));
    expect(refused.status).toBe(403);
    expect(mockGuard).toHaveBeenLastCalledWith(expect.any(NextRequest), "export.with_phones");
    expect(mockCalls).toEqual([]);

    // Without the tick the basic right is enough, and the phone is never read.
    mockTables.seva_receipts = { data: [receiptRow(1)], error: null };
    const plain = await EXPORT(get("/api/seva/reports/export?part=receipts&from=2026-10-01&to=2026-10-21"));
    expect(plain.status).toBe(200);
    expect(mockGuard).toHaveBeenLastCalledWith(expect.any(NextRequest), "export.basic");
    const select = mockCalls.find((c) => c.method === "select");
    expect(String(select?.args[0])).not.toContain("phone");
    const body = (await plain.json()) as { rows: Record<string, unknown>[] };
    expect(body.rows[0]).not.toHaveProperty("phone");
    expect(body.rows[0]).toMatchObject({
      receiptNo: "C1-023-10-2026/000001",
      date: "2026-10-21",
      time: "10:00",
      amountPaise: 61000,
      nakshatra: "Rohini",
      sevaCodes: "PP",
      incomeLedgers: [{ ledger: "Seva Income - Paaduka Pooja", amountPaise: 61000 }],
    });

    // With the right and the tick, the phone comes along.
    mockCalls.length = 0;
    const withPhone = receiptRow(2);
    (withPhone.seva_orders as Record<string, unknown>).phone_e164 = "+919845012345";
    mockTables.seva_receipts = { data: [withPhone], error: null };
    const phones = await EXPORT(get("/api/seva/reports/export?part=receipts&from=2026-10-01&to=2026-10-21&includePhones=true"));
    const phoneBody = (await phones.json()) as { rows: Record<string, unknown>[] };
    expect(phoneBody.rows[0].phone).toBe("+919845012345");
  });

  it("pages exports 1000 rows at a time and excludes test mode", async () => {
    mockTables.seva_receipts = { data: Array.from({ length: 1001 }, (_, i) => receiptRow(i + 1)), error: null };
    const first = await EXPORT(get("/api/seva/reports/export?part=receipts&from=2026-10-01&to=2026-10-21"));
    const firstBody = (await first.json()) as { rows: unknown[]; nextCursor: string | null };
    expect(firstBody.rows).toHaveLength(1000);
    expect(firstBody.nextCursor).toBe("1000");
    expect(mockCalls).toContainEqual({ table: "seva_receipts", method: "range", args: [0, 1000] });
    expect(mockCalls).toContainEqual({ table: "seva_receipts", method: "eq", args: ["test_mode", false] });
    expect(mockCalls).toContainEqual({ table: "seva_receipts", method: "eq", args: ["seva_orders.test_mode", false] });

    mockCalls.length = 0;
    mockTables.seva_receipts = { data: [receiptRow(1001)], error: null };
    const second = await EXPORT(get("/api/seva/reports/export?part=receipts&from=2026-10-01&to=2026-10-21&cursor=1000"));
    const secondBody = (await second.json()) as { rows: unknown[]; nextCursor: string | null };
    expect(secondBody.rows).toHaveLength(1);
    expect(secondBody.nextCursor).toBeNull();
    expect(mockCalls).toContainEqual({ table: "seva_receipts", method: "range", args: [1000, 2000] });

    const bad = await EXPORT(get("/api/seva/reports/export?part=everything&from=2026-10-01&to=2026-10-21"));
    expect(bad.status).toBe(400);
  });

  it("writes the export audit with format, range, parts and the phone flag", async () => {
    mockRpc.mockResolvedValue(1);
    const req = new NextRequest("http://localhost/api/seva/reports/export/audit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        format: "xlsx",
        from: "2026-10-01",
        to: "2026-10-21",
        parts: ["receipts", "sevas"],
        includePhones: true,
      }),
    });
    const res = await EXPORT_AUDIT(req);
    expect(res.status).toBe(200);
    expect(mockGuard).toHaveBeenCalledWith(expect.any(NextRequest), "export.with_phones");
    expect(mockRpc).toHaveBeenCalledWith("seva_audit", {
      p_action: "export.download",
      p_entity: "export",
      p_entity_id: null,
      p_receipt_no: null,
      p_reason: null,
      p_before: null,
      p_after: { format: "xlsx", from: "2026-10-01", to: "2026-10-21", parts: ["receipts", "sevas"], include_phones: true },
      p_staff_id: "staff-a",
    });
  });

  it("continuity names the counter and gives full first and last numbers", async () => {
    mockRpc.mockResolvedValue([
      { series_code: "C1", year: 2026, first_no: 101, last_no: 227, issued: 125, cancelled: 2, open_gaps: 0 },
    ]);
    mockTables.receipt_series = { data: [{ code: "C1", counters: { name: "Counter 1" } }], error: null };
    mockTables.seva_receipts = {
      data: [
        { series_code: "C1", year: 2026, running_no: 101, receipt_no: "C1-023-10-2026/000101" },
        { series_code: "C1", year: 2026, running_no: 227, receipt_no: "C1-023-10-2026/000227" },
      ],
      error: null,
    };
    const res = await CONTINUITY(get("/api/seva/reports/continuity?from=2026-10-01&to=2026-10-21"));
    expect(mockRpc).toHaveBeenCalledWith("seva_continuity", { p_from: "2026-10-01", p_to: "2026-10-21" });
    await expect(res.json()).resolves.toEqual([
      {
        series: "C1",
        year: 2026,
        counterName: "Counter 1",
        firstNo: "C1-023-10-2026/000101",
        lastNo: "C1-023-10-2026/000227",
        numbers: 127,
        issued: 125,
        cancelled: 2,
        openGaps: 0,
      },
    ]);
  });
});
