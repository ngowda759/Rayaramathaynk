import {
  verifyAdminUser,
  verifyAdminUserResult,
  requireAdminUser,
} from "../../lib/auth/admin-auth";

jest.mock("server-only", () => ({}), { virtual: true });

// Supabase Auth is the only identity provider: the admin guard calls
// `createAdminClient().auth.getUser(token)` and loads the authorization record
// from `public.users` keyed by `auth_user_id`.
const mockGetUser = jest.fn();
const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));
const mockCreateAdminClient = jest.fn(() => ({
  auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  from: mockFrom,
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
  } as any;
}

/** Configure Supabase Auth to resolve an authenticated user. */
function mockSupabaseUser(id = "u1", email: string | null = "a@b.c") {
  mockGetUser.mockResolvedValue({ data: { user: { id, email } }, error: null });
}

/** Configure the Supabase `users` lookup to return a row (or none). */
function mockUserRow(row: Record<string, unknown> | null, error: unknown = null) {
  mockMaybeSingle.mockResolvedValue({ data: row, error });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateAdminClient.mockReturnValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: mockFrom,
  });
  mockFrom.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
});

describe("verifyAdminUserResult — header handling", () => {
  it("returns missing_token when the Authorization header is absent", async () => {
    const result = await verifyAdminUserResult(makeRequest(null));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("missing_token");
      expect(result.status).toBe(401);
    }
  });

  it("returns missing_token when the scheme is not Bearer", async () => {
    const result = await verifyAdminUserResult(makeRequest("Basic 123"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing_token");
  });

  it("returns missing_token for an empty bearer value", async () => {
    const result = await verifyAdminUserResult(makeRequest("Bearer    "));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing_token");
  });
});

describe("verifyAdminUserResult — token verification", () => {
  it("returns expired_token for an expired token (401)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "JWT expired", status: 401 },
    });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("expired_token");
      expect(result.status).toBe(401);
    }
  });

  it("returns invalid_token for a malformed token (401)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid JWT", status: 401 },
    });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_token");
  });

  it("returns auth_unavailable (503) when the Supabase admin client cannot be built", async () => {
    mockCreateAdminClient.mockImplementation(() => {
      throw new Error("Missing Supabase environment variables for admin client");
    });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("auth_unavailable");
      expect(result.status).toBe(503);
    }
  });

  it("returns auth_unavailable (503) when Supabase Auth reports a server error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "service unavailable", status: 503 },
    });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("auth_unavailable");
  });
});

describe("verifyAdminUserResult — Supabase authorization", () => {
  beforeEach(() => {
    mockSupabaseUser();
  });

  it("looks the user up in Supabase users by auth_user_id, not profiles", async () => {
    mockUserRow({ role: "super_admin", active: true, email: "admin@t.org" });
    await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockSelect).toHaveBeenCalledWith("role, active, email");
    expect(mockEq).toHaveBeenCalledWith("auth_user_id", "u1");
  });

  it("returns user_not_found (403) when no authorization row exists", async () => {
    mockUserRow(null);
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("user_not_found");
      expect(result.status).toBe(403);
    }
  });

  it("returns inactive_user (403) when active is false", async () => {
    mockUserRow({ role: "super_admin", active: false });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("inactive_user");
  });

  it("returns insufficient_role (403) for blocked roles", async () => {
    mockUserRow({ role: "devotee", active: true });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("insufficient_role");
      expect(result.status).toBe(403);
    }
  });

  it("denies by default when the role is missing or unknown", async () => {
    mockUserRow({ active: true });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    // normalizeRole(undefined) -> "": not on the allowlist: access denied.
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("insufficient_role");
  });

  it("denies the schema default role `user` (allowlist, not denylist)", async () => {
    mockUserRow({ role: "user", active: true });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("insufficient_role");
  });

  it("denies a valid token whose profile lacks admin privilege", async () => {
    mockUserRow({ role: "volunteer", active: true });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("insufficient_role");
      expect(result.status).toBe(403);
    }
  });

  it("returns auth_unavailable (503) when the Supabase query fails", async () => {
    mockUserRow(null, { message: "relation does not exist" });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("auth_unavailable");
      expect(result.status).toBe(503);
    }
  });

  it("accepts an active Super Admin and reports provider supabase", async () => {
    mockUserRow({ role: "Super Admin", active: true, email: "admin@t.org" });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe("supabase");
      expect(result.user.uid).toBe("u1");
      expect(result.user.role).toBe("super_admin");
      expect(result.user.email).toBe("admin@t.org");
      expect(result.user.provider).toBe("supabase");
    }
  });

  it.each([
    "temple_admin",
    "admin",
    "billing",
    "priest",
    "staff",
    "office_staff",
  ])("accepts the recognized admin-console role %s", async (role) => {
    mockUserRow({ role, active: true });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.role).toBe(role);
  });

  it("normalizes spaced/cased role labels before the allowlist check", async () => {
    mockUserRow({ role: "Office Staff", active: true });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.role).toBe("office_staff");
  });

  it("denies non-admin console roles by default", async () => {
    for (const role of ["volunteer", "devotee"]) {
      jest.clearAllMocks();
      mockSupabaseUser();
      mockCreateAdminClient.mockReturnValue({
        auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
        from: mockFrom,
      });
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
      mockUserRow({ role, active: true });
      const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("insufficient_role");
    }
  });

  it("does not expose sensitive identifiers in the rejection body", async () => {
    mockUserRow({ role: "devotee", active: true });
    const result = await requireAdminUser(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      // The token and the raw role must not be echoed back to the caller.
      expect(JSON.stringify(body)).not.toContain("abc");
      expect(JSON.stringify(body)).not.toContain("devotee");
    }
  });
});

describe("verifyAdminUserResult — admin console role allow-list (DB §17.4)", () => {
  beforeEach(() => {
    mockSupabaseUser();
  });

  test.each([
    "",
    "user",
    "devotee",
    "Devotee ",
    "volunteer",
    "receptionist",
    "prasadam_counter",
    "Prasadam Counter",
    "superadmin",
  ])("role %j is refused with 403 insufficient_role", async (role) => {
    mockUserRow({ role, active: true });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result).toEqual({
      ok: false,
      reason: "insufficient_role",
      status: 403,
      message: expect.any(String),
    });
  });

  test.each([
    ["a missing role", undefined],
    ["a null role", null],
    ["an array role", ["super_admin"]],
    ["a numeric role", 1],
    ["an object role", { toString: () => "super_admin" }],
  ])("%s is refused with 403 insufficient_role", async (_label, role) => {
    mockUserRow({ role, active: true });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("insufficient_role");
      expect(result.status).toBe(403);
    }
  });

  test.each([
    ["super_admin", "super_admin"],
    ["temple_admin", "temple_admin"],
    ["Temple Admin", "temple_admin"],
    ["admin", "admin"],
    ["billing", "billing"],
    ["Billing", "billing"],
    ["priest", "priest"],
    ["staff", "staff"],
    ["office_staff", "office_staff"],
    [" Office Staff ", "office_staff"],
  ])("role %j is allowed (as %j)", async (role, normalized) => {
    mockUserRow({ role, active: true });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.role).toBe(normalized);
  });
});

describe("verifyAdminUser (backwards-compatible wrapper)", () => {
  it("returns null for a missing header", async () => {
    expect(await verifyAdminUser(makeRequest(null))).toBeNull();
  });

  it("returns the admin user on success", async () => {
    mockSupabaseUser("u2", "x@y.z");
    mockUserRow({ role: "admin", active: true });
    const user = await verifyAdminUser(makeRequest("Bearer abc"));
    expect(user).not.toBeNull();
    expect(user?.uid).toBe("u2");
  });
});

describe("requireAdminUser", () => {
  it("returns a 401 NextResponse when unauthorized", async () => {
    const result = await requireAdminUser(makeRequest(null));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const body = await result.response.json();
      expect(body.reason).toBe("missing_token");
      // Must not leak sensitive internals in the response body.
      expect(body).not.toHaveProperty("token");
      expect(body).not.toHaveProperty("stack");
    }
  });

  it("returns the admin user when authorized", async () => {
    mockSupabaseUser("u3", "z@z.z");
    mockUserRow({ role: "super_admin", active: true });
    const result = await requireAdminUser(makeRequest("Bearer abc"));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.uid).toBe("u3");
  });
});
