import { renderHook } from "@testing-library/react";
import { useAdminFetch } from "../../hooks/useAdminFetch";
import { useAuth } from "../../hooks/useAuth";

jest.mock("../../hooks/useAuth");

describe("useAdminFetch Hook", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
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

  it("should not append Authorization header when user is null", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null
    });

    const { result } = renderHook(() => useAdminFetch());
    const adminFetch = result.current;

    await adminFetch("/api/test");

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const headers = fetchCall[1].headers as Headers;
    expect(headers.get("Authorization")).toBeNull();
  });
});
