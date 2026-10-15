import { renderHook, act } from "@testing-library/react";
import { useAdminFetch, ADMIN_FETCH_STATUS } from "../../hooks/useAdminFetch";
import { useAuth } from "../../hooks/useAuth";

jest.mock("../../hooks/useAuth");

describe("useAdminFetch Hook", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("appends the Authorization header when a user exists", async () => {
    const mockGetIdToken = jest.fn().mockResolvedValue("mock-token-123");
    (useAuth as jest.Mock).mockReturnValue({
      user: { getIdToken: mockGetIdToken },
      loading: false,
    });

    const { result } = renderHook(() => useAdminFetch());
    await act(async () => {
      await result.current("/api/test");
    });

    expect(mockGetIdToken).toHaveBeenCalled();
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const headers = fetchCall[1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer mock-token-123");
  });

  it("does NOT call fetch while authentication is still initializing", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, loading: true });

    const { result } = renderHook(() => useAdminFetch());
    let res: Response | undefined;
    await act(async () => {
      res = await result.current("/api/test");
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(res?.status).toBe(ADMIN_FETCH_STATUS.AUTH_INITIALIZING);
    const body = await res!.json();
    expect(body.reason).toBe("auth_initializing");
  });

  it("returns a real 401 Response when the user is unauthenticated after init", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, loading: false });

    const { result } = renderHook(() => useAdminFetch());
    let res: Response | undefined;
    await act(async () => {
      res = await result.current("/api/test");
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(res).toBeInstanceOf(Response);
    expect(res?.status).toBe(401);
    const body = await res!.json();
    expect(body.reason).toBe("no_user");
  });

  it("returns a 401 Response when token retrieval fails", async () => {
    const mockGetIdToken = jest
      .fn()
      .mockRejectedValue(new Error("Token generation failed"));
    (useAuth as jest.Mock).mockReturnValue({
      user: { getIdToken: mockGetIdToken },
      loading: false,
    });

    const { result } = renderHook(() => useAdminFetch());
    let res: Response | undefined;
    await act(async () => {
      res = await result.current("/api/test");
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(res?.status).toBe(401);
    const body = await res!.json();
    expect(body.reason).toBe("token_failed");
  });

  it("preserves caller-supplied headers, method and body", async () => {
    const mockGetIdToken = jest.fn().mockResolvedValue("mock-token-123");
    (useAuth as jest.Mock).mockReturnValue({
      user: { getIdToken: mockGetIdToken },
      loading: false,
    });

    const { result } = renderHook(() => useAdminFetch());
    await act(async () => {
      await result.current("/api/test", {
        method: "PUT",
        body: JSON.stringify({ a: 1 }),
        headers: {
          "Content-Type": "application/json",
          "X-Custom-Header": "custom-value",
        },
      });
    });

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const headers = fetchCall[1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer mock-token-123");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-Custom-Header")).toBe("custom-value");
    expect(fetchCall[1].method).toBe("PUT");
    expect(fetchCall[1].body).toBe(JSON.stringify({ a: 1 }));
  });

  it("returns a 408 Response when the request times out", async () => {
    const mockGetIdToken = jest.fn().mockResolvedValue("mock-token-123");
    (useAuth as jest.Mock).mockReturnValue({
      user: { getIdToken: mockGetIdToken },
      loading: false,
    });

    // fetch never resolves until aborted.
    (global.fetch as jest.Mock).mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
          );
        })
    );

    const { result } = renderHook(() => useAdminFetch());
    const res = await result.current("/api/test", { timeoutMs: 50 });
    expect(res.status).toBe(ADMIN_FETCH_STATUS.TIMEOUT);
    const body = await res.json();
    expect(body.reason).toBe("timeout");
  });
});
