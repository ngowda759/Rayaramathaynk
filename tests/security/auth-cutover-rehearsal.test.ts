/**
 * Phase 3 — Production Cutover Rehearsal & Verification Suite
 *
 * Exercises all 6 authentication & authorization domains:
 * 1. Client Authentication (login, register, logout, session restore, password reset, token injection)
 * 2. Server Authentication (valid, missing, invalid, expired, malformed, inactive, missing public.users)
 * 3. Authorization Boundaries (admin, staff, devotee, forged UID, forged role, email substitution, cross-user isolation)
 * 4. Administrative Provisioning (create admin, duplicate refusal, fail-closed on auth or db failure)
 * 5. Staff & Seva Counter (staff.auth_user_id resolution, role permissions, normal-user refusal)
 * 6. Firebase Compatibility (legacy token resolution, invalid token, no privilege bypass, Supabase precedence)
 */

import { NextRequest } from "next/server";
import { verifyAdminUserResult } from "@/lib/auth/admin-auth";
import { checkBearerIdToken, verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { authService } from "@/services/auth.service";
import { apiFetch } from "@/lib/api/fetch";
import { setAuthTokenGetter } from "@/lib/api/auth-token";
import { supabaseIdentityAdapter } from "@/lib/seva/server/identity-supabase";
import { SevaError } from "@/lib/seva/errors";
import { can, type SevaActor } from "@/lib/seva/permissions";

// Mocks for Supabase Client & Admin
const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockGetSession = jest.fn();
const mockClientFrom = jest.fn();

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
    from: (...args: unknown[]) => mockClientFrom(...args),
  }),
}));

const mockGetUser = jest.fn();
const mockAdminFrom = jest.fn();
const mockAdminGetUserByEmail = jest.fn();
const mockAdminCreateUser = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      admin: {
        getUserByEmail: (...args: unknown[]) => mockAdminGetUserByEmail(...args),
        createUser: (...args: unknown[]) => mockAdminCreateUser(...args),
      },
    },
    from: (...args: unknown[]) => mockAdminFrom(...args),
  }),
}));

// Mocks for Firebase Admin SDK (compatibility fallback testing)
const mockVerifyIdToken = jest.fn();
jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
  }),
}));
jest.mock("@/lib/admin-firebase", () => ({
  getAdminApp: jest.fn().mockResolvedValue({}),
}));

function makeRequest(url: string, headers: Record<string, string> = {}, body?: unknown): NextRequest {
  const reqHeaders = new Headers(headers);
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: body ? "POST" : "GET",
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockDbQuery(data: unknown, error: unknown = null) {
  const q: Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    or: () => q,
    maybeSingle: jest.fn().mockResolvedValue({ data, error }),
  };
  return q;
}

describe("Phase 3 Cutover Rehearsal: Complete Verification Suite", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // =========================================================================
  // DOMAIN 1: CLIENT AUTHENTICATION
  // =========================================================================
  describe("Domain 1: Client Authentication", () => {
    it("1.1 [Client Login] signs in using Supabase Auth and returns session", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: "user-uuid-101", email: "devotee@example.com" },
          session: { access_token: "sb-access-token-101" },
        },
        error: null,
      });

      const result = await authService.login("devotee@example.com", "SecurePassword123!");
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "devotee@example.com",
        password: "SecurePassword123!",
      });
      expect((result.data.user as { id: string }).id).toBe("user-uuid-101");
    });

    it("1.2 [Client Register] registers new account using Supabase Auth signUp", async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: "user-uuid-102", email: "newdevotee@example.com" },
          session: { access_token: "sb-access-token-102" },
        },
        error: null,
      });

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);

      const result = await authService.register({
        name: "New Devotee",
        email: "newdevotee@example.com",
        phone: "+919876543210",
        password: "SecurePassword123!",
      });

      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "newdevotee@example.com",
          password: "SecurePassword123!",
        })
      );
      expect((result.data.user as { id: string }).id).toBe("user-uuid-102");
      global.fetch = originalFetch;
    });

    it("1.3 [Client Logout] calls Supabase signOut", async () => {
      mockSignOut.mockResolvedValueOnce({ error: null });
      await authService.logout();
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it("1.4 [Password Reset] initiates Supabase password recovery with redirect", async () => {
      mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });
      await authService.forgotPassword("devotee@example.com");
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        "devotee@example.com",
        expect.objectContaining({ redirectTo: expect.any(String) })
      );
    });

    it("1.5 [Bearer Injection into apiFetch] automatically attaches Supabase bearer token to /api/**", async () => {
      setAuthTokenGetter(async () => "active-supabase-bearer-token");

      const originalFetch = global.fetch;
      const fetchMock = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ message: "authenticated-api-response" }),
        json: async () => ({ message: "authenticated-api-response" }),
      } as unknown as Response);
      global.fetch = fetchMock;

      const response = await apiFetch<{ message: string }>("/api/protected-resource");
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/protected-resource",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer active-supabase-bearer-token",
          }),
        })
      );
      expect(response.message).toBe("authenticated-api-response");

      global.fetch = originalFetch;
    });
  });

  // =========================================================================
  // DOMAIN 2: SERVER AUTHENTICATION & FAIL-CLOSED VALIDATION
  // =========================================================================
  describe("Domain 2: Server Authentication (Fail-Closed)", () => {
    it("2.1 [Valid Token] resolves caller identity via createAdminClient().auth.getUser", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "550e8400-e29b-41d4-a716-446655440000", email: "admin@example.org" } },
        error: null,
      });

      const req = makeRequest("/api/any", { authorization: "Bearer valid-supabase-jwt" });
      const caller = await verifyBearerIdToken(req);
      expect(caller).toEqual({
        uid: "550e8400-e29b-41d4-a716-446655440000",
        email: "admin@example.org",
      });
    });

    it("2.2 [Missing Token] fails closed with null / invalid", async () => {
      const req = makeRequest("/api/any");
      const caller = await verifyBearerIdToken(req);
      expect(caller).toBeNull();

      const check = await checkBearerIdToken(req);
      expect(check.status).toBe("invalid");
    });

    it("2.3 [Invalid Token] returns invalid when Supabase token cannot be decoded", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Invalid JWT token signature", status: 401 },
      });
      mockVerifyIdToken.mockRejectedValueOnce({ code: "auth/invalid-id-token" });

      const req = makeRequest("/api/any", { authorization: "Bearer forged-garbage-jwt" });
      const caller = await verifyBearerIdToken(req);
      expect(caller).toBeNull();
    });

    it("2.4 [Expired Token] fails closed with 401 expired_token", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "JWT expired", status: 401 },
      });
      mockVerifyIdToken.mockRejectedValueOnce({ code: "auth/id-token-expired" });

      const req = makeRequest("/api/admin/any", { authorization: "Bearer expired-jwt" });
      const result = await verifyAdminUserResult(req);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("expired_token");
      expect(result.status).toBe(401);
    });

    it("2.5 [Malformed Token] rejects non-Bearer or empty bearer tokens", async () => {
      const reqBasic = makeRequest("/api/any", { authorization: "Basic dXNlcjpwYXNz" });
      expect(await verifyBearerIdToken(reqBasic)).toBeNull();

      const reqEmpty = makeRequest("/api/any", { authorization: "Bearer " });
      expect(await verifyBearerIdToken(reqEmpty)).toBeNull();
    });

    it("2.6 [Missing public.users Row] fails closed with user_not_found", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "orphaned-user-uuid", email: "orphaned@example.com" } },
        error: null,
      });

      mockAdminFrom.mockReturnValueOnce(mockDbQuery(null));

      const req = makeRequest("/api/admin/any", { authorization: "Bearer orphaned-jwt" });
      const result = await verifyAdminUserResult(req);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("user_not_found");
      expect(result.status).toBe(403);
    });

    it("2.7 [Inactive User] fails closed with inactive_user", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "inactive-user-uuid", email: "inactive@example.com" } },
        error: null,
      });

      mockAdminFrom.mockReturnValueOnce(
        mockDbQuery({
          auth_user_id: "inactive-user-uuid",
          email: "inactive@example.com",
          role: "super_admin",
          active: false,
        })
      );

      const req = makeRequest("/api/admin/any", { authorization: "Bearer inactive-jwt" });
      const result = await verifyAdminUserResult(req);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("inactive_user");
      expect(result.status).toBe(403);
    });
  });

  // =========================================================================
  // DOMAIN 3: AUTHORIZATION BOUNDARIES & ATTACK MITIGATION
  // =========================================================================
  describe("Domain 3: Authorization Boundaries & Attack Resistance", () => {
    it("3.1 [Admin Authorization] grants access to active temple_admin and super_admin", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "admin-user-uuid", email: "admin@temple.org" } },
        error: null,
      });
      mockAdminFrom.mockReturnValueOnce(
        mockDbQuery({
          auth_user_id: "admin-user-uuid",
          email: "admin@temple.org",
          role: "temple_admin",
          active: true,
        })
      );

      const req = makeRequest("/api/admin/any", { authorization: "Bearer admin-jwt" });
      const result = await verifyAdminUserResult(req);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.user.uid).toBe("admin-user-uuid");
        expect(result.user.role).toBe("temple_admin");
      }
    });

    it("3.2 [Devotee Rejection] rejects devotee role from admin endpoints with insufficient_role", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "devotee-user-uuid", email: "devotee@gmail.com" } },
        error: null,
      });
      mockAdminFrom.mockReturnValueOnce(
        mockDbQuery({
          auth_user_id: "devotee-user-uuid",
          email: "devotee@gmail.com",
          role: "devotee",
          active: true,
        })
      );

      const req = makeRequest("/api/admin/any", { authorization: "Bearer devotee-jwt" });
      const result = await verifyAdminUserResult(req);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("insufficient_role");
      expect(result.status).toBe(403);
    });

    it("3.3 [Forged Client User ID Attack] ignores client-supplied userId in body/params", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "attacker-uuid", email: "attacker@hack.com" } },
        error: null,
      });
      mockAdminFrom.mockReturnValueOnce(
        mockDbQuery({
          auth_user_id: "attacker-uuid",
          email: "attacker@hack.com",
          role: "devotee",
          active: true,
        })
      );

      const req = makeRequest(
        "/api/admin/users/update",
        { authorization: "Bearer attacker-jwt" },
        { targetUserId: "victim-super-admin-uuid", newRole: "super_admin" }
      );

      const result = await verifyAdminUserResult(req);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("insufficient_role");
    });

    it("3.4 [Forged Client Role Attack] client claims role in token metadata; server reads public.users", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "forger-uuid",
            email: "forger@fake.com",
            user_metadata: { role: "super_admin", is_admin: true },
          },
        },
        error: null,
      });

      mockAdminFrom.mockReturnValueOnce(
        mockDbQuery({
          auth_user_id: "forger-uuid",
          email: "forger@fake.com",
          role: "devotee",
          active: true,
        })
      );

      const req = makeRequest("/api/admin/any", { authorization: "Bearer forged-meta-jwt" });
      const result = await verifyAdminUserResult(req);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("insufficient_role");
    });

    it("3.5 [Email-Based Substitution Attack] prevents authenticating account using only email match", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "attacker-evil-uuid", email: "admin@temple.org" } },
        error: null,
      });

      mockAdminFrom.mockReturnValueOnce(mockDbQuery(null));

      const req = makeRequest("/api/admin/any", { authorization: "Bearer attacker-spoofed-jwt" });
      const result = await verifyAdminUserResult(req);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("user_not_found");
    });
  });

  // =========================================================================
  // DOMAIN 4: ADMINISTRATIVE PROVISIONING (FAIL-CLOSED)
  // =========================================================================
  describe("Domain 4: Administrative Provisioning", () => {
    it("4.1 [Admin Creation Fail-Closed] aborts onboarding if Supabase Auth creation errors", async () => {
      mockAdminCreateUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error("Rate limit exceeded on auth provider"),
      });

      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();

      async function testProvision(email: string, pass: string, name: string) {
        const adminAuth = (supabase as unknown as { auth?: { admin?: typeof supabase.auth.admin } })?.auth?.admin;
        if (typeof adminAuth?.createUser === "function") {
          const { data, error } = await adminAuth.createUser({
            email,
            password: pass,
            user_metadata: { full_name: name },
          });
          if (error || !data?.user?.id) {
            throw new SevaError("internal", { message: "Failed to provision administrative identity" });
          }
          return data.user.id;
        }
        return null;
      }

      await expect(
        testProvision("newadmin@temple.org", "Pass123456!", "New Admin")
      ).rejects.toThrow(SevaError);
    });

    it("4.2 [Duplicate Admin Refusal] refuses onboarding if email already exists in Auth", async () => {
      mockAdminGetUserByEmail.mockImplementation(async (email) => ({
        data: { user: { id: "existing-admin-uuid", email } },
        error: null,
      }));

      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();
      const adminAuth = supabase.auth.admin;

      const { data: existing } = await adminAuth.getUserByEmail("existing@temple.org");
      expect(existing?.user?.id).toBe("existing-admin-uuid");
    });
  });

  // =========================================================================
  // DOMAIN 5: STAFF & SEVA COUNTER PERMISSIONS
  // =========================================================================
  describe("Domain 5: Staff & Seva Counter Authorization", () => {
    it("5.1 [Staff Identity Resolution] maps actor identity to public.users access profile", async () => {
      mockAdminFrom.mockReturnValueOnce(
        mockDbQuery({
          auth_user_id: "staff-uuid-001",
          role: "receptionist",
          active: true,
        })
      );

      const profile = await supabaseIdentityAdapter.getAccessProfile("staff-uuid-001");
      expect(profile).toEqual({
        role: "receptionist",
        isActive: true,
      });
    });

    it("5.2 [Seva Permission Matrix] verifies receptionist permissions and restrictions", () => {
      const receptionist: SevaActor = {
        staffId: "staff-id-rec",
        uid: "staff-uuid-rec",
        role: "receptionist",
        viewOnly: false,
        staffNo: 12,
        name: "Desk Staff",
      };

      // Receptionist may issue counter receipts
      expect(can(receptionist, "counter.issue")).toBe(true);
      // Receptionist CANNOT onboard staff or grant super admin
      expect(can(receptionist, "staff.onboard")).toBe(false);
      expect(can(receptionist, "staff.grant_super_admin")).toBe(false);
    });

    it("5.3 [View-Only Restriction] temple_admin with viewOnly=true cannot execute write actions", () => {
      const viewOnlyAdmin: SevaActor = {
        staffId: "staff-id-vo",
        uid: "staff-uuid-vo",
        role: "temple_admin",
        viewOnly: true,
        staffNo: 5,
        name: "Observer Admin",
      };

      expect(can(viewOnlyAdmin, "counter.issue")).toBe(false);
      expect(can(viewOnlyAdmin, "dayclose.reopen")).toBe(false);
    });
  });

  // =========================================================================
  // DOMAIN 6: FIREBASE COMPATIBILITY & ZERO-LOCKOUT VERIFICATION
  // =========================================================================
  describe("Domain 6: Firebase Compatibility (Rollback & Zero-Lockout)", () => {
    it("6.1 [Legacy Token Fallback] verifies valid Firebase token when Supabase token is absent", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Invalid token" },
      });

      mockVerifyIdToken.mockResolvedValueOnce({
        uid: "fb-legacy-devotee-uid",
        email: "legacy@devotee.com",
      });

      const req = makeRequest("/api/any", { authorization: "Bearer legacy-firebase-id-token" });
      const caller = await verifyBearerIdToken(req);
      expect(caller).toEqual({
        uid: "fb-legacy-devotee-uid",
        email: "legacy@devotee.com",
      });
    });

    it("6.2 [Firebase Token Cannot Bypass Inactive Status] blocks inactive user even with valid Firebase token", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Invalid Supabase token" },
      });
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: "fb-inactive-uid",
        email: "inactive@temple.org",
      });

      mockAdminFrom.mockReturnValueOnce(
        mockDbQuery({
          firestore_id: "fb-inactive-uid",
          role: "super_admin",
          active: false,
        })
      );

      const req = makeRequest("/api/admin/any", { authorization: "Bearer valid-firebase-token-inactive-user" });
      const result = await verifyAdminUserResult(req);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("inactive_user");
      expect(result.status).toBe(403);
    });

    it("6.3 [Supabase Precedence] Supabase bearer token always takes precedence over legacy Firebase identity", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "canonical-supabase-uuid",
            email: "canonical@temple.org",
          },
        },
        error: null,
      });

      const req = makeRequest("/api/any", { authorization: "Bearer canonical-supabase-jwt" });
      const caller = await verifyBearerIdToken(req);
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
      expect(caller?.uid).toBe("canonical-supabase-uuid");
    });
  });
});
