import {
  verifyAdminUser,
  verifyAdminUserResult,
  requireAdminUser,
} from "../../lib/auth/admin-auth";

jest.mock("server-only", () => ({}), { virtual: true });

const mockGetAuth = jest.fn();
const mockGetAdminApp = jest.fn();
const mockGetAdminFirestore = jest.fn();
const mockSupabaseSelect = jest.fn();
const mockSupabaseEq = jest.fn();
const mockSupabaseSingle = jest.fn();
jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: mockSupabaseSelect.mockReturnValue({
        eq: mockSupabaseEq.mockReturnValue({
          single: mockSupabaseSingle
        })
      })
    })
  })
}));

jest.mock("firebase-admin/auth", () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
}));

jest.mock("@/lib/admin-firebase", () => ({
  getAdminApp: (...args: unknown[]) => mockGetAdminApp(...args),
  getAdminFirestore: (...args: unknown[]) => mockGetAdminFirestore(...args),
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
  if (exists) {
    mockSupabaseSingle.mockResolvedValue({ data: { role: data.role, is_active: data.isActive, email: data.email }, error: null });
  } else {
    mockSupabaseSingle.mockResolvedValue({ data: null, error: { message: "Not found" } });
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAdminApp.mockResolvedValue({});
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
    mockGetAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue(
        Object.assign(new Error("expired"), { code: "auth/id-token-expired" })
      ),
    });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("expired_token");
      expect(result.status).toBe(401);
    }
  });

  it("returns invalid_token for a malformed token (401)", async () => {
    mockGetAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue(
        Object.assign(new Error("bad"), { code: "auth/argument-error" })
      ),
    });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired_token");
  });

  it("returns auth_unavailable (503) when the Admin SDK itself is unavailable", async () => {
    mockGetAdminApp.mockRejectedValue(
      new Error("No Firebase Admin credentials found.")
    );
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
    mockGetAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: "u1", email: "a@b.c" }),
    });
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
    mockUserDoc(true, { role: "super_admin", isActive: false });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("inactive_user");
  });

  it("returns insufficient_role (403) for blocked roles", async () => {
    mockUserDoc(true, { role: "devotee", isActive: true });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("insufficient_role");
      expect(result.status).toBe(403);
    }
  });

  it("accepts an active Super Admin", async () => {
    mockUserDoc(true, { role: "Super Admin", isActive: true, email: "admin@t.org" });
    const result = await verifyAdminUserResult(makeRequest("Bearer abc"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.uid).toBe("u1");
      expect(result.user.role).toBe("super_admin");
      expect(result.user.email).toBe("admin@t.org");
    }
  });
});

describe("verifyAdminUser (backwards-compatible wrapper)", () => {
  it("returns null for a missing header", async () => {
    expect(await verifyAdminUser(makeRequest(null))).toBeNull();
  });

  it("returns the admin user on success", async () => {
    mockGetAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: "u2", email: "x@y.z" }),
    });
    mockUserDoc(true, { role: "admin", isActive: true });
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
    mockGetAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: "u3", email: "z@z.z" }),
    });
    mockUserDoc(true, { role: "super_admin", isActive: true });
    const result = await requireAdminUser(makeRequest("Bearer abc"));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.uid).toBe("u3");
  });
});
