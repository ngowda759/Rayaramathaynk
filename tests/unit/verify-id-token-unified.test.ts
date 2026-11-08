import { checkBearerIdToken, verifyBearerIdToken } from "@/lib/auth/verify-id-token";

const mockGetUser = jest.fn();
const mockVerifyIdToken = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
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

describe("Unified Token Verification (lib/auth/verify-id-token.ts)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns invalid when no Authorization header is present", async () => {
    const request = new Request("http://localhost/api/profile");
    const result = await checkBearerIdToken(request);
    expect(result.status).toBe("invalid");
  });

  it("verifies valid Supabase access token primarily without calling Firebase", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "supa-user-123", email: "devotee@example.com" },
      },
      error: null,
    });

    const request = new Request("http://localhost/api/profile", {
      headers: { Authorization: "Bearer valid-supabase-token" },
    });

    const result = await checkBearerIdToken(request);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.caller.uid).toBe("supa-user-123");
      expect(result.caller.email).toBe("devotee@example.com");
    }
    expect(mockGetUser).toHaveBeenCalledWith("valid-supabase-token");
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it("falls back to Firebase Admin SDK when Supabase token verification fails", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid JWT" },
    });
    mockVerifyIdToken.mockResolvedValue({
      uid: "firebase-uid-456",
      email: "legacy@example.com",
    });

    const request = new Request("http://localhost/api/profile", {
      headers: { Authorization: "Bearer valid-firebase-token" },
    });

    const result = await checkBearerIdToken(request);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.caller.uid).toBe("firebase-uid-456");
      expect(result.caller.email).toBe("legacy@example.com");
    }
    expect(mockGetUser).toHaveBeenCalled();
    expect(mockVerifyIdToken).toHaveBeenCalledWith("valid-firebase-token");
  });

  it("returns invalid when both Supabase and Firebase verifications fail", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid JWT" },
    });
    mockVerifyIdToken.mockRejectedValue({
      code: "auth/argument-error",
      message: "Decoding Firebase ID token failed",
    });

    const request = new Request("http://localhost/api/profile", {
      headers: { Authorization: "Bearer bogus-token" },
    });

    const result = await checkBearerIdToken(request);
    expect(result.status).toBe("invalid");
  });

  it("verifyBearerIdToken returns caller or null", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "user-abc", email: "test@example.com" },
      },
      error: null,
    });

    const request = new Request("http://localhost/api/profile", {
      headers: { Authorization: "Bearer valid-token" },
    });

    const caller = await verifyBearerIdToken(request);
    expect(caller).toEqual({ uid: "user-abc", email: "test@example.com" });
  });
});
