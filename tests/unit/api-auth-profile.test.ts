/**
 * Unit tests for app/api/auth/profile/route.ts
 *
 * Verifies profile API security rules:
 *   1. Canonical profile approval mapping (is_approved / isApproved).
 *   2. Never assume email verification from a valid token claim.
 *   3. Preserve existing role, approval, and active status.
 *   4. Forbid client-controlled privileged field updates (role, isApproved, active).
 *   5. Fail safely and explicitly on Supabase database errors (lookup, update, insert).
 *   6. Fail safely with 503 on auth provider failures.
 */

import { NextRequest } from "next/server";
import { GET, POST, PUT } from "@/app/api/auth/profile/route";

jest.mock("server-only", () => ({}), { virtual: true });

const mockGetUser = jest.fn();

/** Supabase Auth is the only identity provider. */
function mockSupabaseAuth(uid: string, email: string | null, confirmed: boolean) {
  mockGetUser.mockResolvedValueOnce({
    data: { user: { id: uid, email, email_confirmed_at: confirmed ? "2026-01-01T00:00:00.000Z" : null } },
    error: null,
  });
}
jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockSupabaseClient,
}));

type Row = Record<string, unknown>;
const mockUsersTable: Row[] = [];
let mockDbError: Error | null = null;
let mockInsertError: Error | null = null;
let mockUpdateError: Error | null = null;

const mockSupabaseClient = {
  auth: {
    getUser: (...args: unknown[]) => mockGetUser(...args),
  },
  from: () => {
    let orQuery = "";
    const eqFilters: [string, unknown][] = [];

    const builder = {
      select: () => builder,
      or: (q: string) => {
        orQuery = q;
        return builder;
      },
      eq: (col: string, val: unknown) => {
        eqFilters.push([col, val]);
        return builder;
      },
      maybeSingle: async () => {
        if (mockDbError) return { data: null, error: mockDbError };
        let rows = [...mockUsersTable];
        if (orQuery) {
          const parts = orQuery.split(",");
          rows = rows.filter((r) =>
            parts.some((p) => {
              const [col, op, val] = p.split(".");
              return op === "eq" && (r[col] === val);
            })
          );
        }
        for (const [col, val] of eqFilters) {
          rows = rows.filter((r) => r[col] === val);
        }
        return { data: rows[0] ?? null, error: null };
      },
      update: (fields: Record<string, unknown>) => {
        return {
          eq: async (col: string, val: unknown) => {
            if (mockDbError || mockUpdateError) {
              return { data: null, error: mockDbError || mockUpdateError };
            }
            const index = mockUsersTable.findIndex((r) => r[col] === val);
            if (index !== -1) {
              mockUsersTable[index] = { ...mockUsersTable[index], ...fields };
            }
            return { data: mockUsersTable[index] ?? null, error: null };
          },
        };
      },
      insert: async (row: Record<string, unknown>) => {
        if (mockDbError || mockInsertError) {
          return { data: null, error: mockDbError || mockInsertError };
        }
        mockUsersTable.push(row);
        return { data: row, error: null };
      },
    };
    return builder;
  },
};

function makeRequest(
  url: string,
  options: { method?: string; token?: string; body?: unknown } = {}
): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (options.token) {
    headers["authorization"] = `Bearer ${options.token}`;
  }
  return new NextRequest(new URL(url, "http://localhost"), {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUsersTable.length = 0;
  mockDbError = null;
  mockInsertError = null;
  mockUpdateError = null;
  mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("no supabase user") });
});

describe("GET /api/auth/profile", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest("/api/auth/profile"));
    expect(res.status).toBe(401);
  });

  it("never assumes email verification from a valid Supabase token when the email is unconfirmed", async () => {
    mockSupabaseAuth("11111111-1111-4111-8111-111111111111", "unverified@example.org", false);
    mockUsersTable.push({
      id: "u-123",
      auth_user_id: "11111111-1111-4111-8111-111111111111",
      email: "unverified@example.org",
      display_name: "Unverified Devotee",
      role: "devotee",
      active: true,
      is_approved: false,
    });

    const res = await GET(makeRequest("/api/auth/profile", { token: "valid-fb-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.emailVerified).toBe(false);
    expect(body.profile.isApproved).toBe(false);
  });

  it("sets emailVerified true only when the Supabase account email is confirmed", async () => {
    mockSupabaseAuth("22222222-2222-4222-8222-222222222222", "verified@example.org", true);
    mockUsersTable.push({
      id: "u-456",
      auth_user_id: "22222222-2222-4222-8222-222222222222",
      email: "verified@example.org",
      display_name: "Verified Devotee",
      role: "devotee",
      active: true,
      is_approved: true,
    });

    const res = await GET(makeRequest("/api/auth/profile", { token: "valid-fb-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.emailVerified).toBe(true);
    expect(body.profile.isApproved).toBe(true);
  });

  it("correctly maps isApproved: true from canonical is_approved field", async () => {
    mockSupabaseAuth("33333333-3333-4333-8333-333333333333", "admin@example.org", true);
    mockUsersTable.push({
      id: "u-approved",
      auth_user_id: "33333333-3333-4333-8333-333333333333",
      email: "admin@example.org",
      display_name: "Admin User",
      role: "temple_admin",
      active: true,
      is_approved: true,
    });

    const res = await GET(makeRequest("/api/auth/profile", { token: "valid-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.isApproved).toBe(true);
    expect(body.profile.role).toBe("temple_admin");
    expect(body.profile.isActive).toBe(true);
  });

  it("correctly maps isApproved: false when is_approved is false or missing", async () => {
    mockSupabaseAuth("44444444-4444-4444-8444-444444444444", "devotee@example.org", true);
    mockUsersTable.push({
      id: "u-unapproved",
      auth_user_id: "44444444-4444-4444-8444-444444444444",
      email: "devotee@example.org",
      display_name: "Devotee User",
      role: "devotee",
      active: true,
      is_approved: false,
    });

    const res = await GET(makeRequest("/api/auth/profile", { token: "valid-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.isApproved).toBe(false);
  });
  it("reads ONLY canonical is_approved and ignores legacy isApproved property", async () => {
    mockSupabaseAuth("55555555-5555-4555-8555-555555555555", "legacy@example.org", true);
    mockUsersTable.push({
      id: "u-legacy",
      auth_user_id: "55555555-5555-4555-8555-555555555555",
      email: "legacy@example.org",
      display_name: "Legacy User",
      role: "devotee",
      active: true,
      is_approved: false,
      isApproved: true,
    });

    const res = await GET(makeRequest("/api/auth/profile", { token: "valid-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.isApproved).toBe(false);
  });

  it("handles Supabase errors explicitly and returns 500", async () => {
    mockSupabaseAuth("66666666-6666-4666-8666-666666666666", "err@example.org", false);
    mockDbError = new Error("Database timeout");

    const res = await GET(makeRequest("/api/auth/profile", { token: "valid-token" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Database error");
  });

  it("returns 503 when the Supabase authentication provider fails with a server error", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "auth service unavailable", status: 503 },
    });

    const res = await GET(makeRequest("/api/auth/profile", { token: "fb-server-error-token" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Authentication provider error");
  });
});

describe("POST /api/auth/profile", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest("/api/auth/profile", { method: "POST", body: { name: "Test" } })
    );
    expect(res.status).toBe(401);
  });

  it("rejects client-controlled changes to privileged field: role (400)", async () => {
    mockSupabaseAuth("77777777-7777-4777-8777-777777777777", "attacker@example.org", false);

    const res = await POST(
      makeRequest("/api/auth/profile", {
        method: "POST",
        token: "attacker-token",
        body: {
          name: "Attacker",
          role: "super_admin",
        },
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("client-controlled changes to privileged fields are forbidden");
  });

  it("rejects client-controlled changes to privileged field: isApproved (400)", async () => {
    mockSupabaseAuth("77777777-7777-4777-8777-777777777777", "attacker@example.org", false);

    const res = await POST(
      makeRequest("/api/auth/profile", {
        method: "POST",
        token: "attacker-token",
        body: {
          name: "Attacker",
          isApproved: true,
        },
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("client-controlled changes to privileged fields are forbidden");
  });

  it("rejects client-controlled changes to privileged field: is_approved (400)", async () => {
    mockSupabaseAuth("77777777-7777-4777-8777-777777777777", "attacker@example.org", false);

    const res = await POST(
      makeRequest("/api/auth/profile", {
        method: "POST",
        token: "attacker-token",
        body: {
          name: "Attacker",
          is_approved: true,
        },
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("client-controlled changes to privileged fields are forbidden");
  });

  it("rejects client-controlled changes to privileged field: active (400)", async () => {
    mockSupabaseAuth("77777777-7777-4777-8777-777777777777", "attacker@example.org", false);

    const res = await POST(
      makeRequest("/api/auth/profile", {
        method: "POST",
        token: "attacker-token",
        body: {
          name: "Attacker",
          active: true,
        },
      })
    );
    expect(res.status).toBe(400);
  });

  it("preserves existing role, approval, and active status when updating an existing user", async () => {
    mockSupabaseAuth("88888888-8888-4888-8888-888888888888", "staff@example.org", true);
    mockUsersTable.push({
      id: "u-staff",
      auth_user_id: "88888888-8888-4888-8888-888888888888",
      email: "staff@example.org",
      display_name: "Staff Name",
      role: "receptionist",
      active: true,
      is_approved: true,
    });

    const res = await POST(
      makeRequest("/api/auth/profile", {
        method: "POST",
        token: "staff-token",
        body: {
          name: "Updated Staff Name",
          phone: "9876543210",
        },
      })
    );
    expect(res.status).toBe(200);
    const updated = mockUsersTable.find((u) => u.id === "u-staff");
    expect(updated?.display_name).toBe("Updated Staff Name");
    expect(updated?.phone_number).toBe("9876543210");
    expect(updated?.role).toBe("receptionist");
    expect(updated?.active).toBe(true);
    expect(updated?.is_approved).toBe(true);
  });

  it("preserves unapproved status (is_approved: false) when updating profile", async () => {
    mockSupabaseAuth("99999999-9999-4999-8999-999999999999", "unapproved@example.org", true);
    mockUsersTable.push({
      id: "u-unapproved-update",
      auth_user_id: "99999999-9999-4999-8999-999999999999",
      email: "unapproved@example.org",
      display_name: "Original Name",
      role: "devotee",
      active: true,
      is_approved: false,
    });

    const res = await POST(
      makeRequest("/api/auth/profile", {
        method: "POST",
        token: "user-token",
        body: {
          name: "Updated Name",
        },
      })
    );
    expect(res.status).toBe(200);
    const updated = mockUsersTable.find((u) => u.id === "u-unapproved-update");
    expect(updated?.display_name).toBe("Updated Name");
    expect(updated?.is_approved).toBe(false);
  });

  it("creates a new devotee profile with safe defaults when user does not exist", async () => {
    mockSupabaseAuth("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "new@example.org", true);

    const res = await POST(
      makeRequest("/api/auth/profile", {
        method: "POST",
        token: "new-user-token",
        body: {
          name: "New Devotee",
          phone: "1234567890",
        },
      })
    );
    expect(res.status).toBe(200);
    const created = mockUsersTable.find((u) => u.auth_user_id === "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(created).toBeDefined();
    expect(created?.display_name).toBe("New Devotee");
    expect(created?.role).toBe("devotee");
    expect(created?.active).toBe(true);
    expect(created?.is_approved).toBe(false);
  });

  it("fails safely and explicitly returns 500 when Supabase errors on user lookup", async () => {
    mockSupabaseAuth("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "err@example.org", true);
    mockDbError = new Error("Lookup connection error");

    const res = await POST(
      makeRequest("/api/auth/profile", {
        method: "POST",
        token: "staff-token",
        body: {
          name: "Updated Staff Name",
        },
      })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Database error");
  });

  it("fails safely and explicitly returns 500 when Supabase errors on update", async () => {
    mockSupabaseAuth("88888888-8888-4888-8888-888888888888", "staff@example.org", true);
    mockUsersTable.push({
      id: "u-staff",
      auth_user_id: "88888888-8888-4888-8888-888888888888",
      email: "staff@example.org",
      role: "receptionist",
      active: true,
    });
    mockUpdateError = new Error("Update failed");

    const res = await POST(
      makeRequest("/api/auth/profile", {
        method: "POST",
        token: "staff-token",
        body: {
          name: "Updated Staff Name",
        },
      })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Database error");
  });

  it("fails safely and explicitly returns 500 when Supabase errors on insert", async () => {
    mockSupabaseAuth("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "insert@example.org", true);
    mockInsertError = new Error("Insert failed");

    const res = await POST(
      makeRequest("/api/auth/profile", {
        method: "POST",
        token: "insert-token",
        body: {
          name: "New Person",
        },
      })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Database error");
  });

  it("handles PUT method by delegating to POST logic", async () => {
    mockSupabaseAuth("dddddddd-dddd-4ddd-8ddd-dddddddddddd", "put@example.org", true);
    mockUsersTable.push({
      id: "user-put-1",
      auth_user_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      email: "put@example.org",
      display_name: "Original Name",
      role: "devotee",
      active: true,
      is_approved: false,
    });

    const res = await PUT(
      makeRequest("/api/auth/profile", {
        method: "PUT",
        token: "put-token",
        body: {
          name: "Updated via PUT",
        },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockUsersTable[0].display_name).toBe("Updated via PUT");
  });
});
