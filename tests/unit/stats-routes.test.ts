/**
 * @jest-environment node
 *
 * Route tests for the two Supabase-backed statistics routes.
 *
 * They pin the contract requirement 4 of the cutover review cares about:
 *   - `/api/public/stats` needs no authentication and returns ONLY aggregate numbers
 *     (never an email, phone or any row-level value);
 *   - `/api/admin/dashboard-stats` refuses an unauthenticated caller before it ever
 *     touches the database, and only an authorized admin reaches the service role.
 *
 * The Supabase client is stubbed with a chainable thenable so the test asserts the
 * *route's* wiring and its projection, not a database.
 */
import { NextRequest, NextResponse } from "next/server";

jest.mock("server-only", () => ({}), { virtual: true });

const mockRequireAdminUser = jest.fn();
jest.mock("@/lib/auth/admin-auth", () => ({
  requireAdminUser: (...args: unknown[]) => mockRequireAdminUser(...args),
}));

interface TableResult {
  count?: number | null;
  data?: Record<string, unknown>[] | null;
  error?: { message: string } | null;
}

/** A thenable query builder: `select().gte().eq()` all resolve to the same result. */
function builder(result: TableResult) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    gte: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    then: (resolve: (value: TableResult) => unknown) => resolve(result),
  };
  return chain;
}

const mockFrom = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import { GET as publicStats } from "@/app/api/public/stats/route";
import { GET as adminStats } from "@/app/api/admin/dashboard-stats/route";

const results: Record<string, TableResult> = {
  users: { count: 3, error: null },
  volunteers: { count: 2, error: null },
  members: { count: 1, error: null },
  seva_bookings: { count: 4, error: null },
  chat_sessions: { count: 9, error: null },
  events: { count: 6, error: null },
  donations: {
    count: 5,
    // Deliberately sensitive: the public route must never project these.
    data: [
      { email: "donor-one@example.org", phone: "+919845000001" },
      { email: "donor-two@example.org", phone: "+919845000002" },
    ],
    error: null,
  },
};

beforeEach(() => {
  mockFrom.mockReset();
  mockRequireAdminUser.mockReset();
  mockFrom.mockImplementation((table: string) => builder(results[table] ?? { count: 0, error: null }));
});

describe("GET /api/public/stats", () => {
  it("returns only aggregate counts and no row-level values", async () => {
    const response = await publicStats();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.stats).toEqual({
      totalUsers: 3,
      activeVolunteers: 2,
      totalMembers: 1,
      totalDonations: 5,
      totalSevaBookings: 4,
      totalEvents: 6,
      upcomingEvents: 6,
      totalDonors: 4,
    });

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("@example.org");
    expect(serialized).not.toContain("+919845");
  });

  it("does not require an authentication header", async () => {
    await publicStats();
    expect(mockRequireAdminUser).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/dashboard-stats", () => {
  it("rejects an unauthenticated caller before touching the database", async () => {
    mockRequireAdminUser.mockResolvedValue({
      ok: false,
      reason: "missing_token",
      status: 401,
      response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    });

    const response = await adminStats(new NextRequest("http://localhost/api/admin/dashboard-stats"));
    expect(response.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns the full admin summary for an authorized admin", async () => {
    mockRequireAdminUser.mockResolvedValue({
      ok: true,
      user: { uid: "uid-1", email: "admin@example.org", role: "admin" },
    });

    const response = await adminStats(new NextRequest("http://localhost/api/admin/dashboard-stats"));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      totalUsers: 3,
      activeVolunteers: 2,
      totalMembers: 1,
      totalDonations: 5,
      totalSevaBookings: 4,
      totalEvents: 6,
      upcomingEvents: 6,
      totalDonors: 4,
      totalAIConversations: 9,
      donationAmount: 0,
    });
  });
});
