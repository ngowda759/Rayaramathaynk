/**
 * @jest-environment node
 *
 * Admin role promotion (POST /api/admin/users/set-role) must fail closed and must never link or re-point a
 * `public.users` row by email.
 *
 * The identity is resolved from Supabase Auth and the authorization row by `auth_user_id`:
 * 1. Missing Supabase Auth Admin lookup service -> 500
 * 2. Supabase Auth lookup failure -> 500
 * 3. No sign-in account for the email -> 404 (no provisioning, no linking)
 * 4. A resolved identity that is not a UUID -> 500
 * 5. No `public.users` row linked to that identity -> 404
 * 6. The route never writes `public.users.auth_user_id` (no email-based linking)
 * 7. Caller not authorized to grant super_admin -> 403
 * 8. `setAccountRole` runs only for the row resolved by `auth_user_id`, never on a failure.
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
const mockUsersUpdate = jest.fn();

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

const mockGetAccessProfile = jest.fn();
jest.mock("@/lib/seva/server/identity", () => ({
  getIdentityAdapter: () => ({
    findLoginByEmail: jest.fn(),
    getAccessProfile: mockGetAccessProfile,
    verifyRequest: jest.fn(),
    createLogin: jest.fn(),
    setAccessProfile: jest.fn(),
    setLoginEnabled: jest.fn(),
    deleteLogin: jest.fn(),
  }),
}));

import { POST as setRoleHandler } from "@/app/api/admin/users/set-role/route";
import { setAccountRole } from "@/lib/seva/server/staff";

describe("Admin role promotion — fail-closed identity resolution", () => {
  const validUuid = "99999999-9999-9999-9999-999999999999";
  const targetEmail = "promoted@example.test";

  function staffQuery() {
    return {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    };
  }

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
    mockGetUserByEmail.mockReset().mockResolvedValue({
      data: { user: { id: validUuid, email: targetEmail } },
      error: null,
    });
    mockGetAccessProfile.mockReset().mockResolvedValue({ role: "devotee", isActive: true });
    mockFrom.mockReset().mockImplementation((table: string) =>
      table === "staff"
        ? staffQuery()
        : {
            update: (...args: unknown[]) => {
              mockUsersUpdate(...args);
              return {};
            },
          },
    );
  });

  function makeRequest(body: { email: string; role: string }) {
    return new NextRequest("http://localhost/api/admin/users/set-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("1. fails closed (500) when the Supabase Auth Admin service is missing", async () => {
    mockAdminAuthService = null;

    const res = await setRoleHandler(makeRequest({ email: targetEmail, role: "admin" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("internal");
    expect(setAccountRole).not.toHaveBeenCalled();
  });

  it("2. fails closed (500) when the Supabase Auth lookup fails", async () => {
    mockGetUserByEmail.mockReset().mockResolvedValue({ data: null, error: { message: "Auth service connection timeout" } });

    const res = await setRoleHandler(makeRequest({ email: targetEmail, role: "admin" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("internal");
    expect(setAccountRole).not.toHaveBeenCalled();
  });

  it("3. answers not_found (404) and never provisions or links when the email has no sign-in", async () => {
    mockGetUserByEmail.mockReset().mockResolvedValue({ data: { user: null }, error: null });

    const res = await setRoleHandler(makeRequest({ email: targetEmail, role: "admin" }));
    expect(res.status).toBe(404);
    expect(setAccountRole).not.toHaveBeenCalled();
    expect(mockInviteUserByEmail).not.toHaveBeenCalled();
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockUsersUpdate).not.toHaveBeenCalled();
  });

  it("4. fails closed (500) when the resolved identity is not a UUID", async () => {
    mockGetUserByEmail.mockReset().mockResolvedValue({ data: { user: { id: "non-uuid-string" } }, error: null });

    const res = await setRoleHandler(makeRequest({ email: targetEmail, role: "admin" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("internal");
    expect(setAccountRole).not.toHaveBeenCalled();
  });

  it("5. answers not_found (404) when no public.users row is linked to that identity", async () => {
    mockGetAccessProfile.mockReset().mockResolvedValue(null);

    const res = await setRoleHandler(makeRequest({ email: targetEmail, role: "admin" }));
    expect(res.status).toBe(404);
    expect(setAccountRole).not.toHaveBeenCalled();
  });

  it("6. never writes public.users.auth_user_id by email", async () => {
    const res = await setRoleHandler(makeRequest({ email: targetEmail, role: "admin" }));
    expect(res.status).toBe(200);
    expect(mockFrom.mock.calls.every(([table]) => table !== "users")).toBe(true);
    expect(mockUsersUpdate).not.toHaveBeenCalled();
  });

  it("7. refuses a non-super-admin caller granting super_admin (403)", async () => {
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

  it("8. promotes the row resolved by auth_user_id, never a row matched by email", async () => {
    const res = await setRoleHandler(makeRequest({ email: targetEmail, role: "admin" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.userId).toBe(validUuid);
    expect(setAccountRole).toHaveBeenCalledWith(expect.objectContaining({ role: "super_admin" }), {
      externalUid: validUuid,
      role: "admin",
    });
  });
});
