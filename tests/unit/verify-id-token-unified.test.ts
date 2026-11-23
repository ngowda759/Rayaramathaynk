import { checkBearerIdToken, verifyBearerIdToken } from "@/lib/auth/verify-id-token";

const mockGetUser = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
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

  it("verifies a valid Supabase access token", async () => {
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
  });

  it("rejects a token Supabase does not accept, with no fallback to any other provider", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid JWT" },
    });

    const request = new Request("http://localhost/api/profile", {
      headers: { Authorization: "Bearer some-other-provider-token" },
    });

    const result = await checkBearerIdToken(request);
    expect(result.status).toBe("invalid");
    expect(mockGetUser).toHaveBeenCalled();
  });

  it("returns invalid when Supabase verification fails", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid JWT" },
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
    expect(caller).toEqual({
      uid: "user-abc",
      email: "test@example.com",
      emailConfirmedAt: null,
    });
  });
});
