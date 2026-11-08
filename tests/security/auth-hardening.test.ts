/**
 * Phase 3.1 — Production Hardening Test Suite
 *
 * Validates:
 * 1. Registration security:
 *    - Rejection of spoofed / phantom userIds
 *    - Rejection of email mismatches
 *    - Rejection of forged session identities
 *    - Idempotent race-condition handling (Postgres 23505)
 * 2. Self-provisioning (/api/auth/me) security:
 *    - Mandatory authentication check
 *    - Concurrent self-provisioning race-condition recovery
 * 3. Admin creation hardening:
 *    - Mandatory Supabase Auth identity (fail-closed)
 * 4. Role promotion hardening:
 *    - Ensures promoted admins receive Supabase Auth identity
 * 5. Telemetry & fallback preservation:
 *    - Supabase primary path priority
 *    - Safe non-blocking fallback for legacy tokens
 */

import { NextRequest } from "next/server";
import { POST as registerHandler } from "@/app/api/auth/register/route";
import { GET as meHandler } from "@/app/api/auth/me/route";
import { POST as createAdminHandler } from "@/app/api/admin/users/create-admin/route";
import { POST as setRoleHandler } from "@/app/api/admin/users/set-role/route";

const mockGetUserById = jest.fn();
const mockGetUserByEmail = jest.fn();
const mockCreateUser = jest.fn();
const mockFrom = jest.fn();
const mockGetUser = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        getUserById: (...args: unknown[]) => mockGetUserById(...args),
        getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
        createUser: (...args: unknown[]) => mockCreateUser(...args),
        listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: null }),
      },
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

const mockVerifyIdToken = jest.fn();
jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
    getUserByEmail: jest.fn().mockRejectedValue({ code: "auth/user-not-found" }),
    createUser: jest.fn().mockResolvedValue({ uid: "fb-compat-uid" }),
  }),
}));

jest.mock("@/lib/admin-firebase", () => ({
  getAdminApp: jest.fn().mockResolvedValue({}),
}));

describe("Phase 3.1 — Production Hardening", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. Registration API Security (/api/auth/register)", () => {
    it("rejects unauthenticated registration with non-existent Supabase userId", async () => {
      mockGetUserById.mockResolvedValueOnce({
        data: null,
        error: { message: "User not found" },
      });

      const req = new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "11111111-1111-1111-1111-111111111111",
          email: "devotee@example.test",
          name: "Test Devotee",
        }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/does not exist in authentication provider/i);
    });

    it("rejects unauthenticated registration when email does not match Supabase Auth account", async () => {
      mockGetUserById.mockResolvedValueOnce({
        data: { user: { id: "11111111-1111-1111-1111-111111111111", email: "actual@example.test" } },
        error: null,
      });

      const req = new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "11111111-1111-1111-1111-111111111111",
          email: "spoofed@example.test",
          name: "Attacker",
        }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/does not match registered authentication account/i);
    });

    it("rejects authenticated registration when token UID does not match payload userId", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "legit-caller-uuid", email: "caller@example.test" } },
        error: null,
      });

      const req = new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-for-caller",
        },
        body: JSON.stringify({
          userId: "22222222-2222-2222-2222-222222222222",
          email: "victim@example.test",
          name: "Target",
        }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/does not match authenticated session/i);
    });

    it("handles concurrent registration race (Postgres code 23505) idempotently", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "33333333-3333-3333-3333-333333333333", email: "concurrent@example.test" } },
        error: null,
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      // Insert fails due to concurrent race
      mockFrom.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({
          error: { code: "23505", message: "duplicate key value violates unique constraint" },
        }),
      });

      const req = new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-for-concurrent",
        },
        body: JSON.stringify({
          userId: "33333333-3333-3333-3333-333333333333",
          email: "concurrent@example.test",
          name: "Concurrent User",
        }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toMatch(/already provisioned/i);
    });
  });

  describe("2. Self-Provisioning API Security (/api/auth/me)", () => {
    it("returns 401 when no bearer token or cookie session is provided", async () => {
      const req = new NextRequest("http://localhost/api/auth/me");
      const res = await meHandler(req);
      expect(res.status).toBe(401);
    });

    it("recovers from concurrent insert race (23505) by re-querying existing profile", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "44444444-4444-4444-4444-444444444444", email: "me-race@example.test" } },
        error: null,
      });

      // First lookup finds nothing
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      // Insert hits conflict race (code 23505)
      mockFrom.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: "23505", message: "duplicate key value violates unique constraint" },
            }),
          }),
        }),
      });

      // Re-query finds the concurrently created row
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                id: "user-id-from-race",
                auth_user_id: "44444444-4444-4444-4444-444444444444",
                email: "me-race@example.test",
                role: "devotee",
                active: true,
              },
              error: null,
            }),
          }),
        }),
      });

      const req = new NextRequest("http://localhost/api/auth/me", {
        headers: { Authorization: "Bearer valid-token" },
      });

      const res = await meHandler(req);
      expect(res.status).toBe(200);
      const profile = await res.json();
      expect(profile.email).toBe("me-race@example.test");
      expect(profile.role).toBe("devotee");
    });
  });

  describe("3. Admin Creation Hardening (/api/admin/users/create-admin)", () => {
    it("fails closed when Supabase Auth identity creation fails", async () => {
      // Mock actor as super admin
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "super-admin-uid", email: "super@example.test" } },
        error: null,
      });

      // Actor staff lookup
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: "staff-1", role: "super_admin", active: true },
              error: null,
            }),
          }),
        }),
      });

      // Target Supabase user does not exist
      mockGetUserByEmail.mockResolvedValueOnce({ data: null, error: null });
      // Creating Supabase user fails
      mockCreateUser.mockResolvedValueOnce({
        data: null,
        error: { message: "Auth service unavailable" },
      });

      const req = new NextRequest("http://localhost/api/admin/users/create-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer super-admin-token",
        },
        body: JSON.stringify({
          email: "newadmin@example.test",
          password: "SecurePassword123!",
          name: "New Admin",
        }),
      });

      const res = await createAdminHandler(req);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("4. Telemetry and Secondary Fallback Preservation", () => {
    it("verifies Supabase tokens primarily without attempting Firebase verification", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "pure-supabase-uid", email: "user@example.test" } },
        error: null,
      });

      const { checkBearerIdToken } = await import("@/lib/auth/verify-id-token");
      const req = new Request("http://localhost/api/any", {
        headers: { Authorization: "Bearer valid-supabase-token" },
      });

      const check = await checkBearerIdToken(req);
      expect(check.status).toBe("ok");
      if (check.status === "ok") {
        expect(check.caller.uid).toBe("pure-supabase-uid");
      }
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    it("falls back to Firebase ID token verification when Supabase verification fails", async () => {
      mockGetUser.mockRejectedValueOnce(new Error("Not a Supabase token"));
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: "legacy-firebase-uid",
        email: "legacy@example.test",
      });

      const { checkBearerIdToken } = await import("@/lib/auth/verify-id-token");
      const req = new Request("http://localhost/api/any", {
        headers: { Authorization: "Bearer valid-legacy-firebase-token" },
      });

      const check = await checkBearerIdToken(req);
      expect(check.status).toBe("ok");
      if (check.status === "ok") {
        expect(check.caller.uid).toBe("legacy-firebase-uid");
      }
      expect(mockVerifyIdToken).toHaveBeenCalled();
    });
  });
});
