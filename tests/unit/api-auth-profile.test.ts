/**
 * Unit tests for app/api/auth/profile/route.ts
 *
 * Verifies profile API security rules:
 *   1. Never assume email verification from a valid token claim.
 *   2. Preserve existing role and approval/active status.
 *   3. Forbid client-controlled privileged field updates (role, isApproved, active).
 *   4. Fail safely and explicitly on Supabase database errors.
 */

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/auth/profile/route";

jest.mock("server-only", () => ({}), { virtual: true });

const mockGetUser = jest.fn();
const mockVerifyIdToken = jest.fn();
const mockGetAdminApp = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockSupabaseClient,
}));

jest.mock("@/lib/admin-firebase", () => ({
  getAdminApp: (...args: unknown[]) => mockGetAdminApp(...args),
}));

jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
  }),
}));

type Row = Record<string, unknown>;
const mockUsersTable: Row[] = [];
let mockDbError: Error | null = null;

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
            if (mockDbError) return { data: null, error: mockDbError };
            const index = mockUsersTable.findIndex((r) => r[col] === val);
            if (index !== -1) {
              mockUsersTable[index] = { ...mockUsersTable[index], ...fields };
            }
            return { data: mockUsersTable[index] ?? null, error: null };
          },
        };
      },
      insert: async (row: Record<string, unknown>) => {
        if (mockDbError) return { data: null, error: mockDbError };
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
  mockGetAdminApp.mockResolvedValue({});
  mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("no supabase user") });
});

describe("GET /api/auth/profile", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest("/api/auth/profile"));
    expect(res.status).toBe(401);
  });

  it("never assumes email verification from a valid Firebase ID token when email_verified is false", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "fb-uid-123",
      email: "unverified@example.org",
      email_verified: false,
    });
    mockUsersTable.push({
      id: "u-123",
      firestore_id: "fb-uid-123",
      email: "unverified@example.org",
      display_name: "Unverified Devotee",
      role: "devotee",
      active: true,
    });

    const res = await GET(makeRequest("/api/auth/profile", { token: "valid-fb-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.emailVerified).toBe(false);
  });

  it("sets emailVerified true only when token explicitly claims email_verified true", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "fb-uid-456",
      email: "verified@example.org",
      email_verified: true,
    });
    mockUsersTable.push({
      id: "u-456",
      firestore_id: "fb-uid-456",
      email: "verified@example.org",
      display_name: "Verified Devotee",
      role: "devotee",
      active: true,
    });

    const res = await GET(makeRequest("/api/auth/profile", { token: "valid-fb-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.emailVerified).toBe(true);
  });

  it("handles Supabase errors explicitly and returns 500", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "fb-uid-err",
      email: "err@example.org",
      email_verified: false,
    });
    mockDbError = new Error("Database timeout");

    const res = await GET(makeRequest("/api/auth/profile", { token: "valid-token" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Database error");
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
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "fb-uid-attacker",
      email: "attacker@example.org",
      email_verified: false,
    });

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
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "fb-uid-attacker",
      email: "attacker@example.org",
      email_verified: false,
    });

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
  });

  it("preserves existing role and active status when updating an existing user", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "fb-uid-staff",
      email: "staff@example.org",
      email_verified: true,
    });
    mockUsersTable.push({
      id: "u-staff",
      firestore_id: "fb-uid-staff",
      email: "staff@example.org",
      display_name: "Staff Name",
      role: "receptionist",
      active: true,
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
  });

  it("fails safely and explicitly returns 500 when Supabase errors on update", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "fb-uid-staff",
      email: "staff@example.org",
      email_verified: true,
    });
    mockUsersTable.push({
      id: "u-staff",
      firestore_id: "fb-uid-staff",
      email: "staff@example.org",
      role: "receptionist",
      active: true,
    });
    mockDbError = new Error("Connection failed");

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
});
