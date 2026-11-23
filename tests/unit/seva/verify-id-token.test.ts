/**
 * @jest-environment node
 */
import { resolveVerifiedCaller, verifyBearerIdToken } from "@/lib/auth/verify-id-token";

jest.mock("server-only", () => ({}), { virtual: true });

const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  }),
}));

const mockServerGetUser = jest.fn();
const mockServerCreateClient = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockServerCreateClient(...args),
}));

function makeRequest(authorization?: string): Request {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.authorization = authorization;
  return new Request("http://localhost/api/test", { headers });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockServerGetUser.mockReset();
  mockServerCreateClient.mockReset();
  mockServerCreateClient.mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockServerGetUser(...args) },
  });
});

describe("verifyBearerIdToken", () => {
  it("returns null without a Bearer header", async () => {
    expect(await verifyBearerIdToken(makeRequest())).toBeNull();
    expect(await verifyBearerIdToken(makeRequest("Basic abc"))).toBeNull();
    expect(await verifyBearerIdToken(makeRequest("Bearer    "))).toBeNull();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("returns null for an invalid token", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "bad token" } });
    expect(await verifyBearerIdToken(makeRequest("Bearer not-a-token"))).toBeNull();
    expect(mockGetUser).toHaveBeenCalledWith("not-a-token");
  });

  it("returns null when the server cannot verify tokens at all", async () => {
    mockGetUser.mockRejectedValue(new Error("No Supabase credentials found."));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await verifyBearerIdToken(makeRequest("Bearer secret-token-value"))).toBeNull();

    expect(errorSpy).toHaveBeenCalled();
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("secret-token-value");
    errorSpy.mockRestore();
  });

  it("returns uid and email for a valid token", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "devotee@example.org" } }, error: null });
    expect(await verifyBearerIdToken(makeRequest("Bearer good-token"))).toEqual({
      uid: "u1",
      email: "devotee@example.org",
      emailConfirmedAt: null,
    });
    expect(mockGetUser).toHaveBeenCalledWith("good-token");
  });

  it("returns the Supabase confirmation timestamp when present", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "u3",
          email: "confirmed@example.org",
          email_confirmed_at: "2026-01-01T00:00:00Z",
        },
      },
      error: null,
    });

    expect(await verifyBearerIdToken(makeRequest("Bearer good-token"))).toEqual({
      uid: "u3",
      email: "confirmed@example.org",
      emailConfirmedAt: "2026-01-01T00:00:00Z",
    });
  });

  it("returns a null email when the token carries none", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u2", email: null } }, error: null });
    expect(await verifyBearerIdToken(makeRequest("Bearer phone-only"))).toEqual({
      uid: "u2",
      email: null,
      emailConfirmedAt: null,
    });
  });
});

describe("resolveVerifiedCaller", () => {
  it("resolves a cookie session with its confirmation state", async () => {
    mockServerGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "cookie-uid",
          email: "cookie@example.org",
          email_confirmed_at: "2026-01-01T00:00:00Z",
        },
      },
      error: null,
    });

    const result = await resolveVerifiedCaller(makeRequest());

    expect(result).toEqual({
      status: "ok",
      caller: {
        uid: "cookie-uid",
        email: "cookie@example.org",
        emailConfirmedAt: "2026-01-01T00:00:00Z",
      },
    });
  });

  it("returns invalid when there is no bearer token and no cookie session", async () => {
    mockServerGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Auth session missing!", name: "AuthSessionMissingError", status: 400 },
    });

    expect(await resolveVerifiedCaller(makeRequest())).toEqual({ status: "invalid" });
  });

  it("returns invalid when the cookie store is unavailable outside a request", async () => {
    mockServerCreateClient.mockRejectedValueOnce(
      new Error("cookies() was called outside a request scope")
    );

    expect(await resolveVerifiedCaller(makeRequest())).toEqual({ status: "invalid" });
  });

  it("returns invalid when the cookie credentials are rejected", async () => {
    mockServerGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "invalid JWT", status: 401 },
    });

    expect(await resolveVerifiedCaller(makeRequest())).toEqual({ status: "invalid" });
  });

  it("returns invalid when the cookie session has no user", async () => {
    mockServerGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    expect(await resolveVerifiedCaller(makeRequest())).toEqual({ status: "invalid" });
  });

  it("returns unavailable for a cookie-session Supabase 5xx", async () => {
    mockServerGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "down", status: 503 },
    });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await resolveVerifiedCaller(makeRequest())).toEqual({ status: "unavailable" });

    errorSpy.mockRestore();
  });

  it("returns unavailable when the cookie-session verification call throws", async () => {
    mockServerGetUser.mockRejectedValueOnce(new Error("fetch failed"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await resolveVerifiedCaller(makeRequest())).toEqual({ status: "unavailable" });

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("never falls back to the cookie session when a bearer token is present but invalid", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "bad token" } });

    const result = await resolveVerifiedCaller(makeRequest("Bearer not-a-token"));

    expect(result).toEqual({ status: "invalid" });
    expect(mockServerCreateClient).not.toHaveBeenCalled();
    expect(mockServerGetUser).not.toHaveBeenCalled();
  });

  it("reports a bearer-token Supabase server error as unavailable", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "down", status: 503 } });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await resolveVerifiedCaller(makeRequest("Bearer token"))).toEqual({ status: "unavailable" });

    errorSpy.mockRestore();
  });
});
