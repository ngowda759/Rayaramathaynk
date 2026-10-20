/** @jest-environment node */
import { NextRequest } from "next/server";

/**
 * The continuity answer carries each open gap's id and range (DB §8.5, §12.3), so the register can offer Resolve.
 * The gaps are read only for series that have open gaps.
 */

jest.mock("server-only", () => ({}), { virtual: true });

const mockGuard = jest.fn();
jest.mock("@/lib/seva/server/auth", () => ({
  SEVA_DEVICE_HEADER: "x-seva-device",
  requireSevaActor: (...args: unknown[]) => mockGuard(...args),
}));

const mockRpc = jest.fn();
jest.mock("@/lib/seva/server/rpc", () => ({ callRpc: (...args: unknown[]) => mockRpc(...args) }));

const mockCalls: { table: string; method: string; args: unknown[] }[] = [];
const mockTables: Record<string, { data: unknown; error: unknown }> = {};

function mockBuilder(table: string): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order"]) {
    builder[method] = (...args: unknown[]) => {
      mockCalls.push({ table, method, args });
      return builder;
    };
  }
  const answer = () => Promise.resolve(mockTables[table] ?? { data: [], error: null });
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => answer().then(resolve, reject);
  return builder;
}

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => mockBuilder(table) }),
}));

import { GET as CONTINUITY } from "@/app/api/seva/reports/continuity/route";

const ADMIN = { staffId: "staff-a", uid: "u-a", role: "temple_admin", viewOnly: false, staffNo: 2, name: "Admin" };

beforeEach(() => {
  jest.clearAllMocks();
  mockCalls.length = 0;
  for (const key of Object.keys(mockTables)) delete mockTables[key];
  mockGuard.mockResolvedValue({ ok: true, actor: ADMIN, device: null });
  mockTables.receipt_series = { data: [{ code: "OF1", counters: { name: "Counter 1" } }, { code: "C1", counters: { name: "Counter 1" } }], error: null };
  mockTables.seva_receipts = {
    data: [
      { series_code: "OF1", year: 2026, running_no: 1, receipt_no: "OF1-023-10-2026/000001" },
      { series_code: "OF1", year: 2026, running_no: 9, receipt_no: "OF1-023-10-2026/000009" },
    ],
    error: null,
  };
});

describe("continuity open gaps", () => {
  it("lists each open gap with its id and range on its series", async () => {
    mockRpc.mockResolvedValue([
      { series_code: "C1", year: 2026, first_no: null, last_no: null, issued: 0, cancelled: 0, open_gaps: 0 },
      { series_code: "OF1", year: 2026, first_no: 1, last_no: 9, issued: 6, cancelled: 0, open_gaps: 1 },
    ]);
    mockTables.receipt_number_gaps = {
      data: [
        {
          id: 7,
          series_code: "OF1",
          year: 2026,
          from_no: 7,
          to_no: 9,
          cause: "device_replaced",
          detected_at: "2026-10-18T06:00:00+00:00",
        },
      ],
      error: null,
    };

    const res = await CONTINUITY(new NextRequest("http://localhost/api/seva/reports/continuity?from=2026-10-01&to=2026-10-21"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>[];
    expect(body[0]).not.toHaveProperty("gaps");
    expect(body[1]).toMatchObject({
      series: "OF1",
      openGaps: 1,
      gaps: [{ id: 7, series: "OF1", year: 2026, fromNo: 7, toNo: 9, cause: "device_replaced", detectedAt: "2026-10-18T06:00:00.000Z" }],
    });

    const gapCalls = mockCalls.filter((c) => c.table === "receipt_number_gaps");
    expect(gapCalls).toContainEqual({ table: "receipt_number_gaps", method: "eq", args: ["status", "open"] });
    expect(gapCalls).toContainEqual({ table: "receipt_number_gaps", method: "in", args: ["series_code", ["OF1"]] });
  });

  it("does not read the gaps table when no series has an open gap", async () => {
    mockRpc.mockResolvedValue([
      { series_code: "OF1", year: 2026, first_no: 1, last_no: 9, issued: 9, cancelled: 0, open_gaps: 0 },
    ]);
    const res = await CONTINUITY(new NextRequest("http://localhost/api/seva/reports/continuity?from=2026-10-01&to=2026-10-21"));
    expect(res.status).toBe(200);
    expect(mockCalls.some((c) => c.table === "receipt_number_gaps")).toBe(false);
  });

  it("answers 500 internal for a malformed gap row", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockRpc.mockResolvedValue([
      { series_code: "OF1", year: 2026, first_no: 1, last_no: 9, issued: 6, cancelled: 0, open_gaps: 1 },
    ]);
    mockTables.receipt_number_gaps = {
      data: [{ id: 7, series_code: "OF1", year: 2026, from_no: 7, to_no: 9, cause: "bogus", detected_at: "2026-10-18T06:00:00+00:00" }],
      error: null,
    };
    const res = await CONTINUITY(new NextRequest("http://localhost/api/seva/reports/continuity?from=2026-10-01&to=2026-10-21"));
    expect(res.status).toBe(500);
    // The server log carries the code and a request id only.
    expect(logged).toHaveBeenCalledWith("[seva] request failed:", "internal", "request", expect.any(String), "kind", "seva_error");
    logged.mockRestore();
  });
});
