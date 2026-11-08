/**
 * Phase 3 — Supabase Auth Unification Comprehensive Security Test Suite
 *
 * Verifies all 20 mandatory security assertions:
 * 1. Valid Supabase user
 * 2. Invalid Supabase token
 * 3. Expired token
 * 4. Missing token
 * 5. Inactive user
 * 6. Admin authorization
 * 7. Staff authorization
 * 8. Devotee authorization
 * 9. Unauthorized admin access
 * 10. Unauthorized staff access
 * 11. Role escalation attempt
 * 12. Forged client user ID
 * 13. Forged client role
 * 14. Email mismatch
 * 15. Firebase UID mismatch
 * 16. Supabase auth_user_id mismatch
 * 17. Missing public.users
 * 18. Duplicate identity mapping
 * 19. Provisioning failure
 * 20. Partial provisioning
 *
 * Explicitly verifies:
 * - Email matching cannot authenticate a user
 * - Client role cannot elevate privileges
 * - Client user ID cannot select another user's authorization
 * - Firebase UID cannot override auth_user_id
 */

import { NextRequest } from "next/server";
import { verifyAdminUserResult } from "@/lib/auth/admin-auth";
import { checkBearerIdToken, verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { supabaseIdentityAdapter } from "@/lib/seva/server/identity-supabase";
import { SevaError } from "@/lib/seva/errors";

const mockGetUser = jest.fn();
const mockFrom = jest.fn();
const mockVerifyIdToken = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      admin: {
        getUserByEmail: jest.fn(),
        createUser: jest.fn(),
      },
    },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  }),
}));

jest.mock("@/lib/admin-firebase", () => ({
  getAdminApp: jest.fn().mockResolvedValue({}),
}));

jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
  }),
}));

function makeRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers });
}

describe("Phase 3 Supabase Auth Unification Security Test Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Valid Supabase user
  it("1. Valid Supabase user: admits caller and resolves role from public.users via auth_user_id", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "valid-supa-admin-uuid", email: "admin@example.com" } },
      error: null,
    });
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: { role: "admin", active: true, email: "admin@example.com" },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
    });

    const req = makeRequest("http://localhost/api/admin/overview", {
      authorization: "Bearer valid-token",
    });

    const result = await verifyAdminUserResult(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.uid).toBe("valid-supa-admin-uuid");
      expect(result.user.role).toBe("admin");
      expect(result.provider).toBe("supabase");
    }
  });

  // 2. Invalid Supabase token
  it("2. Invalid Supabase token: returns 401 invalid_token when token fails verification in both providers", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid" },
    });
    mockVerifyIdToken.mockRejectedValue(
      Object.assign(new Error("Invalid token"), { code: "auth/invalid-id-token" })
    );

    const req = makeRequest("http://localhost/api/admin/overview", {
      authorization: "Bearer bogus-token",
    });

    const result = await verifyAdminUserResult(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_token");
      expect(result.status).toBe(401);
    }
  });

  // 3. Expired token
  it("3. Expired token: returns 401 expired_token when Supabase token has expired", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "JWT expired" },
    });
    mockVerifyIdToken.mockRejectedValue({ code: "auth/id-token-expired" });

    const req = makeRequest("http://localhost/api/admin/overview", {
      authorization: "Bearer expired-token",
    });

    const result = await verifyAdminUserResult(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("expired_token");
      expect(result.status).toBe(401);
    }
  });

  // 4. Missing token
  it("4. Missing token: returns 401 missing_token when Authorization header is absent", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const req = makeRequest("http://localhost/api/admin/overview");
    const result = await verifyAdminUserResult(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("missing_token");
      expect(result.status).toBe(401);
    }
  });

  // 5. Inactive user
  it("5. Inactive user: rejects user when public.users.active is false", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "inactive-uuid", email: "inactive@example.com" } },
      error: null,
    });
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: { role: "admin", active: false, email: "inactive@example.com" },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
    });

    const req = makeRequest("http://localhost/api/admin/overview", {
      authorization: "Bearer valid-token",
    });

    const result = await verifyAdminUserResult(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("inactive_user");
      expect(result.status).toBe(403);
    }
  });

  // 6. Admin authorization
  it("6. Admin authorization: permits valid super_admin, temple_admin, and admin roles", async () => {
    for (const role of ["super_admin", "temple_admin", "admin"]) {
      mockGetUser.mockResolvedValue({
        data: { user: { id: `admin-${role}-uuid`, email: `${role}@example.com` } },
        error: null,
      });
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: { role, active: true, email: `${role}@example.com` },
        error: null,
      });
      mockFrom.mockReturnValue({
        select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
      });

      const req = makeRequest("http://localhost/api/admin/overview", {
        authorization: "Bearer valid-token",
      });

      const result = await verifyAdminUserResult(req);
      expect(result.ok).toBe(true);
    }
  });

  // 7. Staff authorization
  it("7. Staff authorization: resolves access profile and active status through supabaseIdentityAdapter", async () => {
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: { role: "receptionist", active: true },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ or: () => ({ maybeSingle: mockMaybeSingle }) }),
    });

    const profile = await supabaseIdentityAdapter.getAccessProfile(
      "550e8400-e29b-41d4-a716-446655440001"
    );
    expect(profile).toEqual({ role: "receptionist", isActive: true });
  });

  // 8. Devotee authorization
  it("8. Devotee authorization: allows devotee to access general endpoints via verifyBearerIdToken", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "devotee-uuid-1", email: "devotee@example.com" } },
      error: null,
    });

    const req = makeRequest("http://localhost/api/profile", {
      authorization: "Bearer devotee-token",
    });

    const caller = await verifyBearerIdToken(req);
    expect(caller).toEqual({ uid: "devotee-uuid-1", email: "devotee@example.com" });
  });

  // 9. Unauthorized admin access
  it("9. Unauthorized admin access: blocks devotee with 403 insufficient_role from admin routes", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "devotee-uuid", email: "devotee@example.com" } },
      error: null,
    });
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: { role: "devotee", active: true, email: "devotee@example.com" },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
    });

    const req = makeRequest("http://localhost/api/admin/overview", {
      authorization: "Bearer devotee-token",
    });

    const result = await verifyAdminUserResult(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("insufficient_role");
      expect(result.status).toBe(403);
    }
  });

  // 10. Unauthorized staff access
  it("10. Unauthorized staff access: rejects inactive staff through supabaseIdentityAdapter", async () => {
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: { role: "receptionist", active: false },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ or: () => ({ maybeSingle: mockMaybeSingle }) }),
    });

    const profile = await supabaseIdentityAdapter.getAccessProfile(
      "550e8400-e29b-41d4-a716-446655440001"
    );
    expect(profile?.isActive).toBe(false);
  });

  // 11. Role escalation attempt
  it("11. Role escalation attempt: ignores client-supplied role in headers/query and reads only public.users", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "devotee-uuid", email: "devotee@example.com" } },
      error: null,
    });
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: { role: "devotee", active: true, email: "devotee@example.com" },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
    });

    // Caller attempts to forge admin role via header or query param
    const req = makeRequest("http://localhost/api/admin/overview?role=super_admin", {
      authorization: "Bearer devotee-token",
      "x-user-role": "super_admin",
    });

    const result = await verifyAdminUserResult(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("insufficient_role");
    }
  });

  // 12. Forged client user ID
  it("12. Forged client user ID: verifies only the token identity, ignoring forged uid in request", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "real-user-uuid", email: "real@example.com" } },
      error: null,
    });
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: { role: "devotee", active: true, email: "real@example.com" },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
    });

    const req = makeRequest("http://localhost/api/admin/overview?uid=victim-admin-uuid", {
      authorization: "Bearer real-user-token",
      "x-user-id": "victim-admin-uuid",
    });

    const result = await verifyAdminUserResult(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("insufficient_role");
    }
  });

  // 13. Forged client role
  it("13. Forged client role: client role claim cannot elevate privileges", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "devotee-uuid",
          email: "devotee@example.com",
          user_metadata: { role: "super_admin" }, // Attacker injected metadata claim
        },
      },
      error: null,
    });
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: { role: "devotee", active: true, email: "devotee@example.com" }, // Ground truth in public.users
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
    });

    const req = makeRequest("http://localhost/api/admin/overview", {
      authorization: "Bearer token",
    });

    const result = await verifyAdminUserResult(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("insufficient_role");
    }
  });

  // 14. Email mismatch & no email-only linking
  it("14. Email mismatch: email matching cannot authenticate a user or link identities", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "attacker-uuid", email: "admin@example.com" } },
      error: null,
    });
    // Target user has matching email but different auth_user_id
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: null, // No row for auth_user_id = attacker-uuid
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
    });

    const req = makeRequest("http://localhost/api/admin/overview", {
      authorization: "Bearer attacker-token",
    });

    const result = await verifyAdminUserResult(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("user_not_found");
      expect(result.status).toBe(403);
    }
  });

  // 15. Firebase UID mismatch
  it("15. Firebase UID mismatch: a Firebase token cannot claim another user's firestore_id", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not Supabase" } });
    mockVerifyIdToken.mockResolvedValue({ uid: "fb-attacker-uid", email: "attacker@example.com" });

    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: null, // No row matching firestore_id = fb-attacker-uid
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
    });

    const req = makeRequest("http://localhost/api/admin/overview", {
      authorization: "Bearer fb-attacker-token",
    });

    const result = await verifyAdminUserResult(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("user_not_found");
    }
  });

  // 16. Supabase auth_user_id mismatch
  it("16. Supabase auth_user_id mismatch: Firebase UID cannot override auth_user_id", async () => {
    // When a request arrives with a Supabase token, it resolves strictly by auth_user_id
    mockGetUser.mockResolvedValue({
      data: { user: { id: "canonical-auth-user-id", email: "test@example.com" } },
      error: null,
    });

    const mockEq = jest.fn().mockReturnValue({
      maybeSingle: jest.fn().mockResolvedValue({
        data: { role: "admin", active: true, email: "test@example.com" },
        error: null,
      }),
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: mockEq }),
    });

    const req = makeRequest("http://localhost/api/admin/overview", {
      authorization: "Bearer supa-token",
    });

    await verifyAdminUserResult(req);
    // Verified: strictly queries auth_user_id, not firestore_id
    expect(mockEq).toHaveBeenCalledWith("auth_user_id", "canonical-auth-user-id");
  });

  // 17. Missing public.users
  it("17. Missing public.users: returns 403 user_not_found when user has no authorization record", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "orphan-uuid", email: "orphan@example.com" } },
      error: null,
    });
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
    });

    const req = makeRequest("http://localhost/api/admin/overview", {
      authorization: "Bearer valid-token",
    });

    const result = await verifyAdminUserResult(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("user_not_found");
      expect(result.status).toBe(403);
    }
  });

  // 18. Duplicate identity mapping
  it("18. Duplicate identity mapping: fails closed if lookup returns unexpected multi-row or error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "dup-uuid", email: "dup@example.com" } },
      error: null,
    });
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "Multiple rows returned for query" },
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
    });

    const req = makeRequest("http://localhost/api/admin/overview", {
      authorization: "Bearer valid-token",
    });

    const result = await verifyAdminUserResult(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("auth_unavailable");
      expect(result.status).toBe(503);
    }
  });

  // 19. Provisioning failure
  it("19. Provisioning failure: identity adapter throws internal SevaError on DB connection failure", async () => {
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "connection timeout" },
    });
    mockFrom.mockReturnValue({
      select: () => ({ or: () => ({ maybeSingle: mockMaybeSingle }) }),
    });

    await expect(
      supabaseIdentityAdapter.getAccessProfile("550e8400-e29b-41d4-a716-446655440001")
    ).rejects.toThrow(SevaError);
  });

  // 20. Partial provisioning
  it("20. Partial provisioning: fails closed if user has an auth identity but no role mapping", async () => {
    // When an auth identity exists but public.users profile creation failed:
    mockGetUser.mockResolvedValue({
      data: { user: { id: "partial-uuid", email: "partial@example.com" } },
      error: null,
    });
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: null, // Partial success: Auth user exists, but public.users row is missing
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
    });

    const req = makeRequest("http://localhost/api/admin/overview", {
      authorization: "Bearer token",
    });

    const result = await verifyAdminUserResult(req);
    // Must fail closed with 403 user_not_found
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("user_not_found");
      expect(result.status).toBe(403);
    }
  });
});
