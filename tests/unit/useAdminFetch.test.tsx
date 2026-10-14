import { renderHook } from "@testing-library/react";
import { useAdminFetch } from "../../hooks/useAdminFetch";
import { useAuth } from "../../hooks/useAuth";

jest.mock("../../hooks/useAuth");

describe("useAdminFetch Hook", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({})
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("should append Authorization header when user exists", async () => {
    const mockGetIdToken = jest.fn().mockResolvedValue("mock-token-123");
    (useAuth as jest.Mock).mockReturnValue({
      user: { getIdToken: mockGetIdToken }
    });

    const { result } = renderHook(() => useAdminFetch());
    const adminFetch = result.current;

    await adminFetch("/api/test");

    expect(mockGetIdToken).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith("/api/test", expect.objectContaining({
      headers: expect.any(Headers)
    }));

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const headers = fetchCall[1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer mock-token-123");
  });

  it("should return synthetic 401 when user is null", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null
    });

    const { result } = renderHook(() => useAdminFetch());
    const adminFetch = result.current;

    const res = await adminFetch("/api/test");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("No authenticated user found.");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should return synthetic 401 when token retrieval fails", async () => {
    const mockGetIdToken = jest.fn().mockRejectedValue(new Error("Token generation failed"));
    (useAuth as jest.Mock).mockReturnValue({
      user: { getIdToken: mockGetIdToken }
    });

    const { result } = renderHook(() => useAdminFetch());
    const adminFetch = result.current;

    const res = await adminFetch("/api/test");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Failed to retrieve authentication token.");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should preserve caller-supplied headers", async () => {
    const mockGetIdToken = jest.fn().mockResolvedValue("mock-token-123");
    (useAuth as jest.Mock).mockReturnValue({
      user: { getIdToken: mockGetIdToken }
    });

    const { result } = renderHook(() => useAdminFetch());
    const adminFetch = result.current;

    await adminFetch("/api/test", {
      headers: {
        "Content-Type": "application/json",
        "X-Custom-Header": "custom-value"
      }
    });

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const headers = fetchCall[1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer mock-token-123");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-Custom-Header")).toBe("custom-value");
  });
});
