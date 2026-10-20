/**
 * @jest-environment node
 */
import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";

jest.mock("server-only", () => ({}), { virtual: true });

const mockVerifyIdToken = jest.fn();
const mockGetAdminApp = jest.fn();

jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args) }),
}));

jest.mock("@/lib/admin-firebase", () => ({
  getAdminApp: (...args: unknown[]) => mockGetAdminApp(...args),
}));

function makeRequest(authorization?: string): Request {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.authorization = authorization;
  return new Request("http://localhost/api/test", { headers });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAdminApp.mockResolvedValue({});
});

describe("verifyBearerIdToken", () => {
  it("returns null without a Bearer header", async () => {
    expect(await verifyBearerIdToken(makeRequest())).toBeNull();
    expect(await verifyBearerIdToken(makeRequest("Basic abc"))).toBeNull();
    expect(await verifyBearerIdToken(makeRequest("Bearer    "))).toBeNull();
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it("returns null for an invalid token", async () => {
    mockVerifyIdToken.mockRejectedValue(Object.assign(new Error("bad token"), { code: "auth/argument-error" }));
    expect(await verifyBearerIdToken(makeRequest("Bearer not-a-token"))).toBeNull();
    expect(mockVerifyIdToken).toHaveBeenCalledWith("not-a-token");
  });

  it("returns null when the server cannot verify tokens at all", async () => {
    mockGetAdminApp.mockRejectedValue(new Error("No Firebase Admin credentials found."));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await verifyBearerIdToken(makeRequest("Bearer secret-token-value"))).toBeNull();

    expect(errorSpy).toHaveBeenCalled();
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("secret-token-value");
    errorSpy.mockRestore();
  });

  it("returns uid and email for a valid token", async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: "u1", email: "devotee@example.org" });
    expect(await verifyBearerIdToken(makeRequest("Bearer good-token"))).toEqual({
      uid: "u1",
      email: "devotee@example.org",
    });
    expect(mockVerifyIdToken).toHaveBeenCalledWith("good-token");
  });

  it("returns a null email when the token carries none", async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: "u2" });
    expect(await verifyBearerIdToken(makeRequest("Bearer phone-only"))).toEqual({ uid: "u2", email: null });
  });
});
