import {
  verifyAdminUser,
  verifyAdminUserResult,
  requireAdminUser,
} from "../../lib/auth/admin-auth";

jest.mock("server-only", () => ({}), { virtual: true });

const mockGetUser = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockMaybeSingle = jest.fn();

const mockSupabase = {
  auth: {
    getUser: (...args: unknown[]) => mockGetUser(...args),
  },
  from: () => ({
    select: (...args: unknown[]) => mockSelect(...args),
  }),
};

mockSelect.mockReturnValue({
  eq: (...args: unknown[]) => mockEq(...args),
});
mockEq.mockReturnValue({
  maybeSingle: (...args: unknown[]) => mockMaybeSingle(...args),
});

const mockCreateAdminClient = jest.fn(() => mockSupabase);

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
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

function mockUserDoc(exists: boolean, data: Record<string, unknown> = {}) {
  mockMaybeSingle.mockResolvedValue({
    data: exists ? data : null,
    error: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
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
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthSessionMissingError", message: "token expired" } });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("expired_token");
      expect(result.status).toBe(401);
    }
  });

  it("returns invalid_token for a malformed token (401)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthApiError", message: "invalid JWT" } });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_token");
  });

  it("returns auth_unavailable (503) when the Admin SDK itself is unavailable", async () => {
    mockCreateAdminClient.mockImplementationOnce(() => {
      throw new Error("No Supabase Admin credentials found.");
    });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("auth_unavailable");
      expect(result.status).toBe(503);
    }
  });
});

describe("verifyAdminUserResult — profile checks", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.c" } }, error: null });
  });

  it("returns user_not_found (403) when the Firestore profile is missing", async () => {
    mockUserDoc(false);
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("user_not_found");
      expect(result.status).toBe(403);
    }
  });

  it("returns inactive_user (403) when the profile is inactive", async () => {
    mockUserDoc(true, { role: "super_admin", active: false });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("inactive_user");
  });

  it("returns insufficient_role (403) for blocked roles", async () => {
    mockUserDoc(true, { role: "devotee", active: true });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("insufficient_role");
      expect(result.status).toBe(403);
    }
  });

  it("accepts an active Super Admin", async () => {
    mockUserDoc(true, { role: "Super Admin", active: true, email: "admin@t.org" });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.uid).toBe("u1");
      expect(result.user.role).toBe("super_admin");
      expect(result.user.email).toBe("admin@t.org");
    }
  });
});

describe("verifyAdminUserResult — admin console role allow-list (DB §17.4)", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.c" } }, error: null });
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
    mockUserDoc(true, { role, active: true });
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
    mockUserDoc(true, { role, active: true });
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
    mockUserDoc(true, { role, active: true });
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
    mockGetUser.mockResolvedValue({ data: { user: { id: "u2", email: "x@y.z" } }, error: null });
    mockUserDoc(true, { role: "admin", active: true });
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
    mockGetUser.mockResolvedValue({ data: { user: { id: "u3", email: "z@z.z" } }, error: null });
    mockUserDoc(true, { role: "super_admin", active: true });
    const result = await requireAdminUser(makeRequest("Bearer abc"));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.uid).toBe("u3");
  });
});
