/**
 * @jest-environment node
 */
import { GET } from "@/app/api/public/receipts/route";

const mockVerifyBearerIdToken = jest.fn();
const mockGetAdminFirestore = jest.fn();

jest.mock("@/lib/auth/verify-id-token", () => ({
  verifyBearerIdToken: (...args: unknown[]) => mockVerifyBearerIdToken(...args),
}));

jest.mock("@/lib/admin-firebase", () => ({
  getAdminFirestore: (...args: unknown[]) => mockGetAdminFirestore(...args),
}));

type BookingData = Record<string, unknown>;
interface FakeDoc {
  id: string;
  data: BookingData;
}
interface QueryCall {
  collection: string;
  wheres: [string, string, unknown][];
  orderBys: [string, string][];
  limit: number | null;
}

function millisOf(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return typeof value === "string" ? Date.parse(value) : 0;
}

function timestamp(ms: number) {
  return { toMillis: () => ms, toDate: () => new Date(ms) };
}

/** A small in-memory stand-in for the Admin Firestore query API that records every query. */
function fakeFirestore(collections: Record<string, FakeDoc[]>, calls: QueryCall[]) {
  function makeQuery(call: QueryCall) {
    return {
      where(field: string, op: string, value: unknown) {
        return makeQuery({ ...call, wheres: [...call.wheres, [field, op, value]] });
      },
      orderBy(field: string, direction: string = "asc") {
        return makeQuery({ ...call, orderBys: [...call.orderBys, [field, direction]] });
      },
      limit(n: number) {
        return makeQuery({ ...call, limit: n });
      },
      async get() {
        calls.push(call);
        let docs = [...(collections[call.collection] ?? [])];
        for (const [field, op, value] of call.wheres) {
          if (op !== "==") throw new Error(`fake supports == only, got ${op}`);
          docs = docs.filter((doc) => doc.data[field] === value);
        }
        for (const [field, direction] of [...call.orderBys].reverse()) {
          docs.sort((a, b) => {
            const diff = millisOf(a.data[field]) - millisOf(b.data[field]);
            return direction === "desc" ? -diff : diff;
          });
        }
        if (call.limit !== null) docs = docs.slice(0, call.limit);
        return { docs: docs.map((doc) => ({ id: doc.id, data: () => doc.data })) };
      },
    };
  }
  return {
    collection(name: string) {
      return makeQuery({ collection: name, wheres: [], orderBys: [], limit: null });
    },
  };
}

function booking(id: string, userId: string, createdMs: number): FakeDoc {
  return {
    id,
    data: {
      sevaId: "s1",
      sevaTitle: `Seva ${id}`,
      sevaAmount: 250,
      userId,
      userName: "Devotee Name",
      userEmail: `${id}@example.org`,
      userPhone: "+919845012345",
      preferredDate: "2026-10-20",
      notes: "private note",
      status: "confirmed",
      paymentReference: `PAYREF-${id}`,
      paymentStatus: "completed",
      paymentDate: "2026-10-18",
      paymentMethod: "upi",
      createdAt: timestamp(createdMs),
      updatedAt: timestamp(createdMs),
    },
  };
}

function makeRequest(authorization?: string, query = ""): Request {
  const headers: Record<string, string> = {};
  if (authorization) headers.authorization = authorization;
  return new Request(`http://localhost/api/public/receipts${query}`, { headers });
}

const BASE_MS = Date.UTC(2026, 9, 1);
// 25 bookings for the caller, deliberately out of order, plus 3 for someone else that are newer than all of them.
const callerBookings = Array.from({ length: 25 }, (_, i) => booking(`c${i}`, "u1", BASE_MS + ((i * 7) % 25) * 60_000));
const otherBookings = [0, 1, 2].map((i) => booking(`o${i}`, "u2", BASE_MS + 10 * 86_400_000 + i));

let calls: QueryCall[];

beforeEach(() => {
  jest.clearAllMocks();
  calls = [];
  mockGetAdminFirestore.mockResolvedValue(
    fakeFirestore({ sevaBookings: [...callerBookings, ...otherBookings] }, calls)
  );
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
    expect(mockGetAdminFirestore).not.toHaveBeenCalled();
  });

  it("returns only the caller's own bookings, newest first, at most 20", async () => {
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "u1", email: "c0@example.org" });

    const response = await GET(makeRequest("Bearer good", "?search=o0"));

    expect(response.status).toBe(200);
    const body = await response.json();
    const ids = (body.receipts as { id: string }[]).map((row) => row.id);

    const expected = [...callerBookings]
      .sort((a, b) => millisOf(b.data.createdAt) - millisOf(a.data.createdAt))
      .slice(0, 20)
      .map((doc) => doc.id);
    expect(ids).toEqual(expected);

    // The Firestore query itself is filtered on the owner field.
    expect(calls).toHaveLength(1);
    expect(calls[0].collection).toBe("sevaBookings");
    expect(calls[0].wheres).toEqual([["userId", "==", "u1"]]);
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

  it("answers 500 with a code and no stack when Firestore fails", async () => {
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "u1", email: null });
    mockGetAdminFirestore.mockRejectedValue(new Error("firestore down"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(makeRequest("Bearer good"));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(typeof body.error.code).toBe("string");
    expect(JSON.stringify(body)).not.toContain("firestore down");
    errorSpy.mockRestore();
  });
});
