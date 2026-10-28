/**
 * @jest-environment node
 *
 * `GET /api/public/receipts` reads the caller's own bookings from Supabase
 * `seva_bookings` through the service role. It must return only the caller's rows,
 * newest first, at most 20, and only the six recognition fields - never phone,
 * email, notes or payment references.
 */
import { GET } from "@/app/api/public/receipts/route";

const mockVerifyBearerIdToken = jest.fn();
const mockFrom = jest.fn();

jest.mock("@/lib/auth/verify-id-token", () => ({
  verifyBearerIdToken: (...args: unknown[]) => mockVerifyBearerIdToken(...args),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

interface BookingRow {
  id: string;
  firestore_id: string | null;
  user_id: string;
  seva_title: string;
  seva_amount: number | null;
  preferred_date: string | null;
  status: string | null;
  payment_status: string | null;
  created_at: string;
}

/** Every booking, including the columns the route must never return. */
function row(id: string, userId: string, createdMs: number): BookingRow & Record<string, unknown> {
  return {
    id: `uuid-${id}`,
    firestore_id: id,
    user_id: userId,
    seva_title: `Seva ${id}`,
    seva_amount: 250,
    preferred_date: "2026-10-20",
    status: "confirmed",
    payment_status: "completed",
    created_at: new Date(createdMs).toISOString(),
    // Deliberately sensitive: the route must not project these.
    user_name: "Devotee Name",
    user_email: `${id}@example.org`,
    user_phone: "+919845012345",
    notes: "private note",
    payment_reference: `PAYREF-${id}`,
  };
}

interface QueryCall {
  table: string;
  eq: [string, unknown][];
  order: [string, { ascending: boolean }][];
  limit: number | null;
}

/** A chainable Supabase query-builder stub that records the filters applied. */
function makeSupabase(rows: BookingRow[]): { client: { from: (t: string) => unknown }; calls: QueryCall[] } {
  const calls: QueryCall[] = [];
  const client = {
    from(table: string) {
      const call: QueryCall = { table, eq: [], order: [], limit: null };
      calls.push(call);
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq(field: string, value: unknown) {
          call.eq.push([field, value]);
          return builder;
        },
        order(field: string, options: { ascending: boolean }) {
          call.order.push([field, options]);
          return builder;
        },
        limit(n: number) {
          call.limit = n;
          return builder;
        },
        then(resolve: (v: unknown) => unknown) {
          let data = [...rows];
          for (const [field, value] of call.eq) {
            data = data.filter((r) => (r as Record<string, unknown>)[field] === value);
          }
          for (const [field, options] of [...call.order].reverse()) {
            data.sort((a, b) => {
              const diff = Date.parse(String((a as Record<string, unknown>)[field])) -
                Date.parse(String((b as Record<string, unknown>)[field]));
              return options.ascending ? diff : -diff;
            });
          }
          if (call.limit !== null) data = data.slice(0, call.limit);
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
  return { client, calls };
}

function makeRequest(authorization?: string, query = ""): Request {
  const headers: Record<string, string> = {};
  if (authorization) headers.authorization = authorization;
  return new Request(`http://localhost/api/public/receipts${query}`, { headers });
}

const BASE_MS = Date.UTC(2026, 9, 1);
// 25 bookings for the caller, deliberately out of order, plus 3 for someone else that are newer than all of them.
const callerBookings = Array.from({ length: 25 }, (_, i) => row(`c${i}`, "u1", BASE_MS + ((i * 7) % 25) * 60_000));
const otherBookings = [0, 1, 2].map((i) => row(`o${i}`, "u2", BASE_MS + 10 * 86_400_000 + i));

let calls: QueryCall[];

beforeEach(() => {
  jest.clearAllMocks();
  const supabase = makeSupabase([...callerBookings, ...otherBookings]);
  calls = supabase.calls;
  mockFrom.mockImplementation(supabase.client.from);
});

describe("GET /api/public/receipts", () => {
  it("answers 401 with code unauthenticated when no token is sent", async () => {
    mockVerifyBearerIdToken.mockResolvedValue(null);

    const response = await GET(makeRequest(undefined, "?search=9845012345"));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("unauthenticated");
    expect(typeof body.error.message).toBe("string");
    expect(body).not.toHaveProperty("receipts");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns only the caller's own bookings, newest first, at most 20", async () => {
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "u1", email: "c0@example.org" });

    const response = await GET(makeRequest("Bearer good", "?search=o0"));

    expect(response.status).toBe(200);
    const body = await response.json();
    const ids = (body.receipts as { id: string }[]).map((row) => row.id);

    const expected = [...callerBookings]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 20)
      .map((r) => r.firestore_id);
    expect(ids).toEqual(expected);

    // The Supabase query itself is scoped to the caller and bounded.
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("seva_bookings");
    expect(calls[0].eq).toEqual([["user_id", "u1"]]);
    expect(calls[0].limit).not.toBeNull();
    expect(calls[0].limit).toBeLessThanOrEqual(20);
  });

  it("returns only id, sevaTitle, preferredDate, status, paymentStatus and amount", async () => {
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "u1", email: null });

    const response = await GET(makeRequest("Bearer good"));
    const body = await response.json();

    expect(body.receipts.length).toBeGreaterThan(0);
    for (const row of body.receipts as Record<string, unknown>[]) {
      expect(Object.keys(row).sort()).toEqual(
        ["amount", "id", "paymentStatus", "preferredDate", "sevaTitle", "status"].sort()
      );
    }
    const first = body.receipts[0] as Record<string, unknown>;
    expect(first.amount).toBe(250);
    expect(first.sevaTitle).toBe(`Seva ${first.id}`);

    const text = JSON.stringify(body);
    expect(text).not.toContain("+919845012345");
    expect(text).not.toContain("@example.org");
    expect(text).not.toContain("PAYREF-");
    expect(text).not.toContain("private note");
  });

  it("answers 500 with a code and no stack when the datastore fails", async () => {
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "u1", email: null });
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: null, error: { message: "seva_bookings down" } }),
          }),
        }),
      }),
    }));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(makeRequest("Bearer good"));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(typeof body.error.code).toBe("string");
    expect(JSON.stringify(body)).not.toContain("seva_bookings down");
    errorSpy.mockRestore();
  });
});
