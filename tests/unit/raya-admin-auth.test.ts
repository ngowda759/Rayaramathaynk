// Unit tests for the Supabase-native Raya AI admin guard.
//
// These exercise the real code path in `lib/auth/raya-admin-auth.ts` with only
// the two external boundaries mocked: the Supabase server client (session
// resolution) and the Supabase admin client (role lookup). Every failure reason
// and status code is asserted, because the routes depend on the distinction
// between "unauthenticated" (401), "unauthorized" (403) and "server not
// configured" (503).

jest.mock("server-only", () => ({}), { virtual: true });

const mockGetUser = jest.fn();

// Session (cookie) client.
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: mockGetUser } })),
}));

// Admin client: token verification + the `users` role lookup.
const mockGetUserWithToken = jest.fn();
const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));
const mockCreateAdminClient = jest.fn(() => ({
  auth: { getUser: mockGetUserWithToken },
  from: mockFrom,
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

import {
  verifyRayaAdminUserResult,
  requireRayaAdminUser,
} from "../../lib/auth/raya-admin-auth";

function makeRequest(authHeader: string | null = null) {
  return {
    headers: {
      get: jest.fn((name: string) =>
        name.toLowerCase() === "authorization" ? authHeader : null
      ),
    },
  } as any;
}

function mockSessionUser(user: { id: string; email?: string } | null, error: unknown = null) {
  mockGetUser.mockResolvedValue({ data: { user }, error });
}

function mockTokenUser(user: { id: string; email?: string } | null, error: unknown = null) {
  mockGetUserWithToken.mockResolvedValue({ data: { user }, error });
}

function mockUserRow(row: Record<string, unknown> | null, error: unknown = null) {
  mockMaybeSingle.mockResolvedValue({ data: row, error });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateAdminClient.mockReturnValue({
    auth: { getUser: mockGetUserWithToken },
    from: mockFrom,
  });
  mockFrom.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
});

describe("verifyRayaAdminUserResult — session resolution", () => {
  it("returns missing_token (401) when there is no session", async () => {
    mockSessionUser(null, { message: "Auth session missing!" });
    const result = await verifyRayaAdminUserResult(makeRequest(null));
    expect(result).toMatchObject({ ok: false, reason: "missing_token", status: 401 });
  });

  it("returns missing_token (401) for a malformed Authorization header", async () => {
    const result = await verifyRayaAdminUserResult(makeRequest("Basic 123"));
    expect(result).toMatchObject({ ok: false, reason: "missing_token", status: 401 });
  });

  it("returns missing_token (401) for an empty bearer value", async () => {
    const result = await verifyRayaAdminUserResult(makeRequest("Bearer    "));
    expect(result).toMatchObject({ ok: false, reason: "missing_token", status: 401 });
  });

  it("returns auth_unavailable (503) when the Supabase session client cannot be created", async () => {
    const server = jest.requireMock("@/lib/supabase/server");
    server.createClient.mockRejectedValueOnce(new Error("no cookies()"));
    const result = await verifyRayaAdminUserResult(makeRequest(null));
    expect(result).toMatchObject({ ok: false, reason: "auth_unavailable", status: 503 });
  });

  it("returns invalid_token (401) for a bad bearer token", async () => {
    mockTokenUser(null, { message: "invalid JWT", status: 401 });
    const result = await verifyRayaAdminUserResult(makeRequest("Bearer bad"));
    expect(result).toMatchObject({ ok: false, reason: "invalid_token", status: 401 });
  });

  it("returns expired_token (401) for an expired bearer token", async () => {
    mockTokenUser(null, { message: "JWT expired", status: 401 });
    const result = await verifyRayaAdminUserResult(makeRequest("Bearer old"));
    expect(result).toMatchObject({ ok: false, reason: "expired_token", status: 401 });
  });

  it("accepts a valid bearer token", async () => {
    mockTokenUser({ id: "auth-1", email: "admin@t.org" });
    mockUserRow({ role: "super_admin", active: true, email: "admin@t.org" });
    const result = await verifyRayaAdminUserResult(makeRequest("Bearer good"));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.uid).toBe("auth-1");
  });
});

describe("verifyRayaAdminUserResult — Supabase authorization", () => {
  beforeEach(() => {
    mockSessionUser({ id: "auth-1", email: "a@b.c" });
  });

  it("looks the user up by auth_user_id in public.users", async () => {
    mockUserRow({ role: "super_admin", active: true, email: "admin@t.org" });
    await verifyRayaAdminUserResult(makeRequest(null));
    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockSelect).toHaveBeenCalledWith("role, active, email");
    expect(mockEq).toHaveBeenCalledWith("auth_user_id", "auth-1");
  });

  it("returns user_not_found (403) when no authorization row exists", async () => {
    mockUserRow(null);
    const result = await verifyRayaAdminUserResult(makeRequest(null));
    expect(result).toMatchObject({ ok: false, reason: "user_not_found", status: 403 });
  });

  it("returns inactive_user (403) when active is false", async () => {
    mockUserRow({ role: "super_admin", active: false });
    const result = await verifyRayaAdminUserResult(makeRequest(null));
    expect(result).toMatchObject({ ok: false, reason: "inactive_user", status: 403 });
  });

  it("returns insufficient_role (403) for a non-admin role", async () => {
    mockUserRow({ role: "devotee", active: true });
    const result = await verifyRayaAdminUserResult(makeRequest(null));
    expect(result).toMatchObject({ ok: false, reason: "insufficient_role", status: 403 });
  });

  it("denies the schema default role `user` (allowlist, not denylist)", async () => {
    mockUserRow({ role: "user", active: true });
    const result = await verifyRayaAdminUserResult(makeRequest(null));
    expect(result).toMatchObject({ ok: false, reason: "insufficient_role" });
  });

  it("denies a missing/unknown role by default", async () => {
    mockUserRow({ active: true });
    const result = await verifyRayaAdminUserResult(makeRequest(null));
    expect(result).toMatchObject({ ok: false, reason: "insufficient_role" });
  });

  it("returns auth_unavailable (503) when the admin client cannot be created", async () => {
    mockCreateAdminClient.mockImplementationOnce(() => {
      throw new Error("Missing Supabase environment variables for admin client");
    });
    const result = await verifyRayaAdminUserResult(makeRequest(null));
    expect(result).toMatchObject({ ok: false, reason: "auth_unavailable", status: 503 });
  });

  it("returns auth_unavailable (503) when the role query fails", async () => {
    mockUserRow(null, { message: "relation does not exist" });
    const result = await verifyRayaAdminUserResult(makeRequest(null));
    expect(result).toMatchObject({ ok: false, reason: "auth_unavailable", status: 503 });
  });

  it("accepts an active Super Admin and normalizes the role", async () => {
    mockUserRow({ role: "Super Admin", active: true, email: "admin@t.org" });
    const result = await verifyRayaAdminUserResult(makeRequest(null));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.role).toBe("super_admin");
      expect(result.user.email).toBe("admin@t.org");
    }
  });

  it.each(["temple_admin", "admin", "billing", "priest", "staff", "office_staff"])(
    "accepts the recognized admin-console role %s",
    async (role) => {
      mockUserRow({ role, active: true });
      const result = await verifyRayaAdminUserResult(makeRequest(null));
      expect(result.ok).toBe(true);
    }
  );
});

describe("requireRayaAdminUser", () => {
  it("returns a 401 NextResponse and leaks no token on failure", async () => {
    mockSessionUser(null, { message: "Auth session missing!" });
    const result = await requireRayaAdminUser(makeRequest(null));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const body = await result.response.json();
      expect(body.reason).toBe("missing_token");
      expect(body).not.toHaveProperty("token");
      expect(body).not.toHaveProperty("stack");
    }
  });

  it("returns the admin user when authorized", async () => {
    mockSessionUser({ id: "auth-9", email: "z@z.z" });
    mockUserRow({ role: "admin", active: true });
    const result = await requireRayaAdminUser(makeRequest(null));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.uid).toBe("auth-9");
  });
});
