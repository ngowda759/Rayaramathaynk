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
      is_approved: false,
    });

    const res = await GET(makeRequest("/api/auth/profile", { token: "valid-fb-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.emailVerified).toBe(false);
    expect(body.profile.isApproved).toBe(false);
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
      is_approved: true,
    });

    const res = await GET(makeRequest("/api/auth/profile", { token: "valid-fb-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.emailVerified).toBe(true);
    expect(body.profile.isApproved).toBe(true);
  });

  it("correctly maps isApproved: true from canonical is_approved field", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "fb-uid-approved",
      email: "admin@example.org",
      email_verified: true,
    });
    mockUsersTable.push({
      id: "u-approved",
      firestore_id: "fb-uid-approved",
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
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "fb-uid-unapproved",
      email: "devotee@example.org",
      email_verified: true,
    });
    mockUsersTable.push({
      id: "u-unapproved",
      firestore_id: "fb-uid-unapproved",
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
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "fb-uid-legacy",
      email: "legacy@example.org",
      email_verified: true,
    });
    mockUsersTable.push({
      id: "u-legacy",
      firestore_id: "fb-uid-legacy",
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

  it("returns 503 when Firebase authentication provider fails with server error", async () => {
    const error = Object.assign(new Error("Firebase auth unavailable"), { code: "auth/internal-error" });
    mockVerifyIdToken.mockRejectedValueOnce(error);

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
    const body = await res.json();
    expect(body.error).toContain("client-controlled changes to privileged fields are forbidden");
  });

  it("rejects client-controlled changes to privileged field: is_approved (400)", async () => {
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
          is_approved: true,
        },
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("client-controlled changes to privileged fields are forbidden");
  });

  it("rejects client-controlled changes to privileged field: active (400)", async () => {
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
          active: true,
        },
      })
    );
    expect(res.status).toBe(400);
  });

  it("preserves existing role, approval, and active status when updating an existing user", async () => {
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
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "fb-uid-unapproved-update",
      email: "unapproved@example.org",
      email_verified: true,
    });
    mockUsersTable.push({
      id: "u-unapproved-update",
      firestore_id: "fb-uid-unapproved-update",
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
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "fb-uid-new",
      email: "new@example.org",
      email_verified: true,
    });

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
    const created = mockUsersTable.find((u) => u.firestore_id === "fb-uid-new");
    expect(created).toBeDefined();
    expect(created?.display_name).toBe("New Devotee");
    expect(created?.role).toBe("devotee");
    expect(created?.active).toBe(true);
    expect(created?.is_approved).toBe(false);
  });

  it("fails safely and explicitly returns 500 when Supabase errors on user lookup", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "fb-uid-lookup-err",
      email: "err@example.org",
      email_verified: true,
    });
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
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "fb-uid-insert-err",
      email: "insert@example.org",
      email_verified: true,
    });
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
});
