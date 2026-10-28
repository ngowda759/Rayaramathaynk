// Regression guard for the browser access-token wiring.
//
// `apiFetch` (lib/api/fetch.ts) attaches the signed-in admin's Firebase ID token
// as an `Authorization: Bearer` header. Every `/api/admin/**` route verifies that
// header with `requireAdminUser`; with no token the route answers 401 and the whole
// admin console breaks. The token is supplied by a getter that `AuthContext`
// registers once through `setAuthTokenGetter` — a function that shipped with the
// client/server split but, for a time, had no caller, so `getAuthToken()` always
// returned `null` and no header was ever sent.
//
// This test pins both halves: the helper forwards the registered getter's token, and
// the real `AuthContext` module actually calls `setAuthTokenGetter` (so a future edit
// that drops the registration fails here instead of silently at runtime).

import fs from "fs";
import path from "path";

import { apiFetch, ApiError } from "@/lib/api/fetch";
import { getAuthToken, setAuthTokenGetter } from "@/lib/api/auth-token";

describe("apiFetch Authorization header", () => {
  afterEach(() => {
    setAuthTokenGetter(null);
    jest.restoreAllMocks();
  });

  it("attaches the registered token as a Bearer header", async () => {
    setAuthTokenGetter(async () => "id-token-abc");
    expect(await getAuthToken()).toBe("id-token-abc");

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "{}",
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await apiFetch("/api/admin/testimonials");

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer id-token-abc"
    );
  });

  it("omits the header when no getter is registered", async () => {
    expect(await getAuthToken()).toBeNull();

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "{}",
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await apiFetch("/api/admin/testimonials");

    const [, init] = fetchMock.mock.calls[0];
    expect("Authorization" in (init.headers as Record<string, string>)).toBe(false);
  });

  it("sends no Authorization header for public endpoints (auth: false)", async () => {
    setAuthTokenGetter(async () => "id-token-abc");

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "{}",
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await apiFetch("/api/public/stats", { auth: false });

    const [, init] = fetchMock.mock.calls[0];
    expect("Authorization" in (init.headers as Record<string, string>)).toBe(false);
  });

  it("throws ApiError carrying the server message on a non-2xx answer", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Missing or malformed Authorization header." }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiFetch("/api/admin/testimonials")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("AuthContext registers the token getter", () => {
  it("calls setAuthTokenGetter so apiFetch can authenticate admin routes", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "context/AuthContext.tsx"),
      "utf8"
    );
    expect(source).toContain('from "@/lib/api/auth-token"');
    expect(source).toContain("setAuthTokenGetter(");
  });
});
