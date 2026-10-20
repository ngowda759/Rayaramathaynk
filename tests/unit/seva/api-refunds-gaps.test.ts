/**
 * @jest-environment node
 *
 * A5-FIX F4 routes, through the real guard (requireSevaActor) with a fake identity provider:
 * - POST /api/seva/receipts/refund (M-3): temple admins and super admins mark refund-due receipts as refunded;
 *   receptionists, the prasadam counter and view-only admins get 403.
 */
import { NextRequest } from "next/server";
import type { IdentityAdapter } from "@/lib/seva/server/identity";
import { setIdentityAdapterForTests } from "@/lib/seva/server/identity";

jest.mock("server-only", () => ({}), { virtual: true });

// ---- Supabase: the staff row the guard reads -------------------------------------------------------------------------
type Row = Record<string, unknown>;
const mockStaff: Row[] = [];

function mockFakeSupabase() {
  return {
    from(table: string) {
      const filters: [string, unknown][] = [];
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return query;
        },
        async maybeSingle() {
          const rows = table === "staff" ? mockStaff.filter((row) => filters.every(([c, v]) => row[c] === v)) : [];
          return { data: rows[0] ?? null, error: null };
        },
      };
      return query;
    },
  };
}
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockFakeSupabase() }));

const mockCallRpc = jest.fn();
jest.mock("@/lib/seva/server/rpc", () => ({ callRpc: (...args: unknown[]) => mockCallRpc(...args) }));
const mockListByIds = jest.fn();
jest.mock("@/lib/seva/server/receipts", () => ({ listReceiptsByIds: (...args: unknown[]) => mockListByIds(...args) }));

import { POST as refundPOST } from "@/app/api/seva/receipts/refund/route";

const RECEIPT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

const fakeIdentity: jest.Mocked<IdentityAdapter> = {
  verifyRequest: jest.fn(),
  getAccessProfile: jest.fn(),
  createLogin: jest.fn(),
  setAccessProfile: jest.fn(),
  setLoginEnabled: jest.fn(),
  deleteLogin: jest.fn(),
};

type Who = "R" | "P" | "TA" | "TV" | "SA";
const FIRESTORE_ROLE: Record<Who, string> = {
  R: "receptionist",
  P: "prasadam_counter",
  TA: "temple_admin",
  TV: "temple_admin",
  SA: "super_admin",
};

function signIn(who: Who): void {
  mockStaff.length = 0;
  mockStaff.push({
    id: "staff-1",
    firebase_uid: "uid-1",
    staff_no: 8,
    full_name: "Prakash",
    email: "prakash@example.org",
    view_only: who === "TV",
    status: "active",
  });
  fakeIdentity.verifyRequest.mockResolvedValue({ externalUid: "uid-1", email: "prakash@example.org" });
  fakeIdentity.getAccessProfile.mockResolvedValue({ role: FIRESTORE_ROLE[who], isActive: true });
}

function post(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", authorization: "Bearer good-token" },
  });
}

let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  setIdentityAdapterForTests(fakeIdentity);
  mockCallRpc.mockResolvedValue({ receipts: [], refunded_total: "105.00" });
  mockListByIds.mockResolvedValue([{ id: RECEIPT_ID, refundState: "done" }]);
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  errorSpy.mockRestore();
});

afterAll(() => {
  setIdentityAdapterForTests(null);
});

describe("POST /api/seva/receipts/refund (A5-FIX M-3)", () => {
  const valid = { receiptIds: [RECEIPT_ID, OTHER_ID, RECEIPT_ID], mode: "upi", reference: " UTR 60211904 ", note: "Paid back from the bank app" };

  it.each(["R", "P", "TV"] as const)("%s gets 403 and nothing is written", async (who) => {
    signIn(who);
    const res = await refundPOST(post("/api/seva/receipts/refund", valid));
    expect(res.status).toBe(403);
    expect(mockCallRpc).not.toHaveBeenCalled();
  });

  it.each(["TA", "SA"] as const)("%s settles: seva_settle_refund gets the ids once each, the mode, reference and note", async (who) => {
    signIn(who);
    const res = await refundPOST(post("/api/seva/receipts/refund", valid));
    expect(res.status).toBe(200);
    expect(mockCallRpc).toHaveBeenCalledWith("seva_settle_refund", {
      p_receipt_ids: [RECEIPT_ID, OTHER_ID],
      p_mode: "upi",
      p_reference: "UTR 60211904",
      p_note: "Paid back from the bank app",
      p_staff_id: "staff-1",
    });
    expect(mockListByIds).toHaveBeenCalledWith([RECEIPT_ID, OTHER_ID]);
    expect(await res.json()).toEqual({ receipts: [{ id: RECEIPT_ID, refundState: "done" }] });
  });

  it("refuses a short note, a missing reference unless cash, and an unknown mode before the database", async () => {
    signIn("TA");
    for (const body of [
      { ...valid, note: "ok" },
      { ...valid, reference: undefined },
      { ...valid, mode: "bank_transfer", reference: " 12 " },
      { ...valid, mode: "cheque" },
      { ...valid, receiptIds: [] },
    ]) {
      const res = await refundPOST(post("/api/seva/receipts/refund", body));
      expect(res.status).toBe(400);
    }
    expect(mockCallRpc).not.toHaveBeenCalled();

    const cash = await refundPOST(post("/api/seva/receipts/refund", { ...valid, mode: "cash", reference: "" }));
    expect(cash.status).toBe(200);
    expect(mockCallRpc).toHaveBeenCalledWith("seva_settle_refund", expect.objectContaining({ p_mode: "cash", p_reference: null }));
  });

  it("answers 401 without a sign-in", async () => {
    fakeIdentity.verifyRequest.mockResolvedValue(null);
    const res = await refundPOST(post("/api/seva/receipts/refund", valid));
    expect(res.status).toBe(401);
  });
});
