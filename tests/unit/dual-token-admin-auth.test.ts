/**
 * @jest-environment node
 *
 * Dedicated tests for Phase 2 dual-token admin authentication:
 * Primary path: Supabase Auth. Secondary fallback path: Firebase Auth.
 */

import { NextRequest } from "next/server";
import {
  verifyAdminUserResult,
  requireAdminUser,
} from "../../lib/auth/admin-auth";

jest.mock("server-only", () => ({}), { virtual: true });

const mockGetAuth = jest.fn();
const mockGetAdminApp = jest.fn();

jest.mock("firebase-admin/auth", () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
}));

jest.mock("@/lib/admin-firebase", () => ({
  getAdminApp: (...args: unknown[]) => mockGetAdminApp(...args),
}));

const mockGetUser = jest.fn();
const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));
const mockCreateAdminClient = jest.fn(() => ({
  from: mockFrom,
  auth: { getUser: mockGetUser },
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

function makeRequest(authHeader: string | null) {
  return {
    headers: {
      get: jest.fn((name: string) =>
        name.toLowerCase() === "authorization" ? authHeader : null
      ),
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAdminApp.mockResolvedValue({});
  mockCreateAdminClient.mockReturnValue({
    from: mockFrom,
    auth: { getUser: mockGetUser },
  });
  mockFrom.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
});

describe("Dual-Token Admin Auth — Primary Path (Supabase Auth)", () => {
  it("authenticates a valid Supabase admin and labels provider as supabase", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "sb-admin-uuid-1", email: "sb.admin@example.org" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "super_admin", active: true, email: "sb.admin@example.org" },
      error: null,
    });

    const result = await verifyAdminUserResult(makeRequest("Bearer sb-valid-jwt"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe("supabase");
      expect(result.user).toEqual({
        uid: "sb-admin-uuid-1",
        email: "sb.admin@example.org",
        role: "super_admin",
        provider: "supabase",
      });
    }

    // Looked up by auth_user_id
    expect(mockEq).toHaveBeenCalledWith("auth_user_id", "sb-admin-uuid-1");
    // Firebase Admin was NOT called because Supabase succeeded
    expect(mockGetAuth).not.toHaveBeenCalled();
  });

  it("refuses an inactive Supabase user with inactive_user (403)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "sb-inactive-uuid", email: "inactive@example.org" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "admin", active: false, email: "inactive@example.org" },
      error: null,
    });

    const result = await verifyAdminUserResult(makeRequest("Bearer sb-jwt"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("inactive_user");
      expect(result.status).toBe(403);
    }
  });

  it("refuses a Supabase user with insufficient role with 403", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "sb-devotee-uuid", email: "devotee@example.org" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "devotee", active: true, email: "devotee@example.org" },
      error: null,
    });

    const result = await verifyAdminUserResult(makeRequest("Bearer sb-jwt"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("insufficient_role");
      expect(result.status).toBe(403);
    }
  });

  it("refuses a Supabase user missing a public.users authorization row with user_not_found (403)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "sb-unmapped-uuid", email: "unmapped@example.org" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await verifyAdminUserResult(makeRequest("Bearer sb-jwt"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("user_not_found");
      expect(result.status).toBe(403);
    }
    // Critical: Firebase fallback MUST NOT be invoked when Supabase identity is found
    expect(mockGetAuth).not.toHaveBeenCalled();
  });

  it("strictly prevents privilege escalation: unauthorized or inactive Supabase identity NEVER falls back to Firebase", async () => {
    // 1. Inactive Supabase user with bearer token
    mockGetUser.mockResolvedValue({
      data: { user: { id: "sb-inactive-uuid-2", email: "inactive2@example.org" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "admin", active: false, email: "inactive2@example.org" },
      error: null,
    });

    const inactiveResult = await verifyAdminUserResult(makeRequest("Bearer sb-inactive-token"));
    expect(inactiveResult.ok).toBe(false);
    expect(inactiveResult.reason).toBe("inactive_user");
    expect(mockGetAuth).not.toHaveBeenCalled();

    // 2. Devotee role Supabase user with bearer token
    mockGetUser.mockResolvedValue({
      data: { user: { id: "sb-devotee-uuid-2", email: "devotee2@example.org" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "devotee", active: true, email: "devotee2@example.org" },
      error: null,
    });

    const nonAdminResult = await verifyAdminUserResult(makeRequest("Bearer sb-devotee-token"));
    expect(nonAdminResult.ok).toBe(false);
    expect(nonAdminResult.reason).toBe("insufficient_role");
    expect(mockGetAuth).not.toHaveBeenCalled();
  });

  it("identifies expired Supabase token and returns expired_token (401) without unsafe fallback", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "JWT expired: token has expired at 1700000000" },
    });
    mockGetAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue(
        Object.assign(new Error("Invalid token"), { code: "auth/invalid-id-token" })
      ),
    });

    const result = await verifyAdminUserResult(makeRequest("Bearer sb-expired-token"));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("expired_token");
    expect(result.status).toBe(401);
  });
});

describe("Dual-Token Admin Auth — Secondary Path (Firebase Fallback)", () => {
  it("falls back to Firebase when token is rejected by Supabase Auth and authenticates successfully", async () => {
    // Supabase rejects the token (e.g. invalid signature for Supabase)
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid JWT token" },
    });

    // Firebase verifies the token successfully
    mockGetAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({
        uid: "fb-admin-uid-1",
        email: "fb.admin@example.org",
      }),
    });

    // public.users lookup by firestore_id succeeds
    mockMaybeSingle.mockResolvedValue({
      data: { role: "temple_admin", active: true, email: "fb.admin@example.org" },
      error: null,
    });

    const result = await verifyAdminUserResult(makeRequest("Bearer fb-id-token"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe("firebase");
      expect(result.user).toEqual({
        uid: "fb-admin-uid-1",
        email: "fb.admin@example.org",
        role: "temple_admin",
        provider: "firebase",
      });
    }

    expect(mockEq).toHaveBeenCalledWith("firestore_id", "fb-admin-uid-1");
  });

  it("refuses an inactive Firebase user with inactive_user (403)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    mockGetAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: "fb-inactive", email: "in@t.org" }),
    });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "admin", active: false, email: "in@t.org" },
      error: null,
    });

    const result = await verifyAdminUserResult(makeRequest("Bearer fb-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("inactive_user");
      expect(result.status).toBe(403);
    }
  });

  it("refuses a Firebase user missing a public.users authorization row with user_not_found (403)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    mockGetAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: "fb-orphan", email: "orp@t.org" }),
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await verifyAdminUserResult(makeRequest("Bearer fb-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("user_not_found");
      expect(result.status).toBe(403);
    }
  });

  it("returns expired_token (401) when Firebase reports token expiration", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    mockGetAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue(
        Object.assign(new Error("Token expired"), { code: "auth/id-token-expired" })
      ),
    });

    const result = await verifyAdminUserResult(makeRequest("Bearer expired-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("expired_token");
      expect(result.status).toBe(401);
    }
  });

  it("returns invalid_token (401) when both Supabase and Firebase reject token", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    mockGetAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue(
        Object.assign(new Error("Invalid token"), { code: "auth/invalid-id-token" })
      ),
    });

    const result = await verifyAdminUserResult(makeRequest("Bearer garbage-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_token");
      expect(result.status).toBe(401);
    }
  });
});

describe("Dual-Token Admin Auth — Common Security Controls", () => {
  it("rejects missing authorization header with missing_token (401)", async () => {
    const result = await verifyAdminUserResult(makeRequest(null));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("missing_token");
      expect(result.status).toBe(401);
    }
  });

  it("rejects non-Bearer scheme with missing_token (401)", async () => {
    const result = await verifyAdminUserResult(makeRequest("Custom xyz"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("missing_token");
      expect(result.status).toBe(401);
    }
  });

  it("does not leak secret tokens in the rejection response of requireAdminUser", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    mockGetAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue(
        Object.assign(new Error("Invalid"), { code: "auth/invalid-id-token" })
      ),
    });

    const secretToken = "super-sensitive-secret-token-12345";
    const res = await requireAdminUser(makeRequest(`Bearer ${secretToken}`));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const body = await res.response.json();
      expect(JSON.stringify(body)).not.toContain(secretToken);
    }
  });
});
