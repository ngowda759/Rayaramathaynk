/**
 * @jest-environment node
 *
 * Phase 3.1 Review Finding 1 — Admin Role Promotion Fail-Closed Verification
 *
 * Validates that /api/admin/users/set-role strictly fails closed on:
 * 1. Missing Supabase Auth Admin lookup/management service (500)
 * 2. Supabase Auth lookup failures (500)
 * 3. Supabase Auth creation / invitation failures (500)
 * 4. Invalid Supabase Auth UUIDs (500)
 * 5. Database update failures when syncing public.users.auth_user_id (500)
 * 6. Database identity mismatch between auth_user_id and Supabase Auth identity (500)
 * 7. Caller not authorized to grant super_admin (403)
 * 8. Ensures setAccountRole is NEVER executed on any failure, preventing unsafe role promotion.
 */

import { NextRequest } from "next/server";
import type { SevaActor } from "@/lib/seva/permissions";

const mockSession: { actor: SevaActor | null } = {
  actor: {
    staffId: "0f6e2b1a-1c1d-4e5f-8a9b-000000000001",
    uid: "0f6e2b1a-1c1d-4e5f-8a9b-000000000001",
    role: "super_admin",
    viewOnly: false,
    staffNo: 1,
    name: "Super Admin",
  },
};

jest.mock("@/lib/seva/server/staff", () => {
  const actual = jest.requireActual("@/lib/seva/server/staff");
  return {
    ...actual,
    requireStaffAdmin: jest.fn(async () => {
      const actor = mockSession.actor;
      if (!actor) {
        return {
          ok: false,
          response: new Response(JSON.stringify({ error: { code: "unauthenticated", message: "unauthenticated" } }), { status: 401 }),
        };
      }
      return { ok: true, actor, device: null };
    }),
    setAccountRole: jest.fn(async () => ({ audited: true })),
  };
});

const mockGetUserByEmail = jest.fn();
const mockInviteUserByEmail = jest.fn();
const mockCreateUser = jest.fn();
const mockFrom = jest.fn();

let mockAdminAuthService: Record<string, unknown> | null = {
  getUserByEmail: mockGetUserByEmail,
  inviteUserByEmail: mockInviteUserByEmail,
  createUser: mockCreateUser,
};

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: mockAdminAuthService,
    },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

const mockFindLoginByEmail = jest.fn();
const mockGetAccessProfile = jest.fn();
jest.mock("@/lib/seva/server/identity", () => ({
  getIdentityAdapter: () => ({
    findLoginByEmail: mockFindLoginByEmail,
    getAccessProfile: mockGetAccessProfile,
    verifyRequest: jest.fn(),
    createLogin: jest.fn(),
    setAccessProfile: jest.fn(),
    setLoginEnabled: jest.fn(),
    deleteLogin: jest.fn(),
  }),
}));

const mockFirebaseGetUserByEmail = jest.fn();
jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    getUserByEmail: (...args: unknown[]) => mockFirebaseGetUserByEmail(...args),
  }),
}));
jest.mock("@/lib/admin-firebase", () => ({
  getAdminApp: jest.fn().mockResolvedValue({}),
}));

import { POST as setRoleHandler } from "@/app/api/admin/users/set-role/route";
import { setAccountRole } from "@/lib/seva/server/staff";

describe("Phase 3.1 — Admin Role Promotion Mandatory Fail-Closed", () => {
  const validUuid = "99999999-9999-9999-9999-999999999999";
  const targetEmail = "promoted@example.test";

  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminAuthService = {
      getUserByEmail: mockGetUserByEmail,
      inviteUserByEmail: mockInviteUserByEmail,
      createUser: mockCreateUser,
    };
    mockSession.actor = {
      staffId: "0f6e2b1a-1c1d-4e5f-8a9b-000000000001",
      uid: "0f6e2b1a-1c1d-4e5f-8a9b-000000000001",
      role: "super_admin",
      viewOnly: false,
      staffNo: 1,
      name: "Super Admin",
    };
    mockFirebaseGetUserByEmail.mockResolvedValue({ uid: validUuid });
    mockGetUserByEmail.mockResolvedValue({
      data: { user: { id: validUuid, email: targetEmail } },
      error: null,
    });
    mockFindLoginByEmail.mockResolvedValue({
      externalUid: validUuid,
      displayName: "Target User",
      emailVerified: true,
      disabled: false,
    });
    mockGetAccessProfile.mockResolvedValue({
      role: "devotee",
      isActive: true,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "staff") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null, // target is not staff yet
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "users") {
        return {
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: "user-1", auth_user_id: validUuid },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });
  });

  function makeRequest(body: { email: string; role: string }) {
    return new NextRequest("http://localhost/api/admin/users/set-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("1. Fails closed (500) and blocks role promotion when Auth Admin service is missing", async () => {
    // findLoginUid succeeds via Firebase fallback, but requireAdminSupabaseIdentity fails on missing service
    mockAdminAuthService = null;

    const res = await setRoleHandler(makeRequest({ email: targetEmail, role: "admin" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("internal");
    expect(setAccountRole).not.toHaveBeenCalled();
  });

  it("2. Fails closed (500) and blocks role promotion when getUserByEmail throws an error in identity sync", async () => {
    // 1st call for findLoginUid succeeds
    mockGetUserByEmail
      .mockResolvedValueOnce({ data: { user: { id: validUuid } }, error: null })
      // 2nd call in requireAdminSupabaseIdentity fails
      .mockResolvedValueOnce({ data: null, error: { message: "Auth service connection timeout" } });

    const res = await setRoleHandler(makeRequest({ email: targetEmail, role: "admin" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("internal");
    expect(setAccountRole).not.toHaveBeenCalled();
  });

  it("3. Fails closed (500) and blocks role promotion when provisioning (invite and create) fails", async () => {
    // 1st call for findLoginUid finds Firebase identity
    mockGetUserByEmail.mockResolvedValueOnce({ data: null, error: null }); // Supabase not yet created
    // 2nd call in requireAdminSupabaseIdentity finds no user
    mockGetUserByEmail.mockResolvedValueOnce({ data: null, error: null });
    mockInviteUserByEmail.mockResolvedValueOnce({ data: null, error: { message: "Invite disabled" } });
    mockCreateUser.mockResolvedValueOnce({ data: null, error: { message: "Create rejected" } });

    const res = await setRoleHandler(makeRequest({ email: targetEmail, role: "admin" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("internal");
    expect(setAccountRole).not.toHaveBeenCalled();
  });

  it("4. Fails closed (500) and blocks role promotion when resolved identity is not a valid UUID", async () => {
    mockGetUserByEmail
      .mockResolvedValueOnce({ data: { user: { id: "non-uuid-string" } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: "non-uuid-string" } }, error: null });

    const res = await setRoleHandler(makeRequest({ email: targetEmail, role: "admin" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("internal");
    expect(setAccountRole).not.toHaveBeenCalled();
  });

  it("5. Fails closed (500) and blocks role promotion when updating public.users.auth_user_id fails", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "staff") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "users") {
        return {
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: "Database connection lost" },
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await setRoleHandler(makeRequest({ email: targetEmail, role: "admin" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("internal");
    expect(setAccountRole).not.toHaveBeenCalled();
  });

  it("6. Fails closed (500) and blocks role promotion when database record contains mismatched auth_user_id", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "staff") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "users") {
        return {
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: "user-1", auth_user_id: "88888888-8888-8888-8888-888888888888" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await setRoleHandler(makeRequest({ email: targetEmail, role: "admin" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("internal");
    expect(setAccountRole).not.toHaveBeenCalled();
  });

  it("7. Refuses a non-super-admin caller attempting to grant super_admin (403)", async () => {
    mockSession.actor = {
      staffId: "0f6e2b1a-1c1d-4e5f-8a9b-000000000008",
      uid: "0f6e2b1a-1c1d-4e5f-8a9b-000000000008",
      role: "temple_admin",
      viewOnly: false,
      staffNo: 8,
      name: "Temple Admin",
    };

    const res = await setRoleHandler(makeRequest({ email: targetEmail, role: "super_admin" }));
    expect(res.status).toBe(403);
    expect(setAccountRole).not.toHaveBeenCalled();
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
  });

  it("8. Successfully promotes user to admin only when identity verification and synchronization succeed", async () => {
    const res = await setRoleHandler(makeRequest({ email: targetEmail, role: "admin" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.userId).toBe(validUuid);
    expect(setAccountRole).toHaveBeenCalledWith(
      expect.objectContaining({ role: "super_admin" }),
      { externalUid: validUuid, role: "admin" }
    );
  });
});
