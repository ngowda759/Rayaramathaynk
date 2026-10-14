import { verifyAdminUser } from "../../lib/auth/admin-auth";

// Mock server-only to avoid actual imports failing
jest.mock("server-only", () => ({}), { virtual: true });

describe("Admin Auth Validation", () => {
  it("should return null if Authorization header is missing", async () => {
    const request = {
      headers: {
        get: jest.fn().mockReturnValue(null)
      }
    } as any;

    const result = await verifyAdminUser(request);
    expect(result).toBeNull();
    expect(request.headers.get).toHaveBeenCalledWith("authorization");
  });

  it("should return null if Authorization header does not start with Bearer", async () => {
    const request = {
      headers: {
        get: jest.fn().mockReturnValue("Basic 123")
      }
    } as any;

    const result = await verifyAdminUser(request);
    expect(result).toBeNull();
  });
});
