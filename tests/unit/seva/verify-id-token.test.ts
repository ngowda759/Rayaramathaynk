/**
 * @jest-environment node
 */
import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";

jest.mock("server-only", () => ({}), { virtual: true });

const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  }),
}));

function makeRequest(authorization?: string): Request {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.authorization = authorization;
  return new Request("http://localhost/api/test", { headers });
}

beforeEach(() => {
  jest.clearAllMocks();
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
    });
    expect(mockGetUser).toHaveBeenCalledWith("good-token");
  });

  it("returns a null email when the token carries none", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u2", email: null } }, error: null });
    expect(await verifyBearerIdToken(makeRequest("Bearer phone-only"))).toEqual({ uid: "u2", email: null });
  });
});
