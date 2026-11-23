/**
 * lib/auth/oauth.ts — Google sign-in initiation.
 *
 * Pins the two things this module is responsible for: the callback URL it asks Supabase to return to
 * (sanitized `next`, always this origin) and the feature flag's default-off behaviour. Nothing here
 * decides who the person is; that is the callback route's job.
 */

const mockSignInWithOAuth = jest.fn();

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args) } }),
}));

import {
  buildOAuthFailureUrl,
  buildOAuthRedirectTo,
  isAllowedAuthOrigin,
  isGoogleSignInEnabled,
  signInWithGoogle,
} from "@/lib/auth/oauth";

const ORIGIN = "https://www.srsmathaynk.com";

beforeEach(() => {
  jest.clearAllMocks();
  mockSignInWithOAuth.mockResolvedValue({ data: { provider: "google", url: "https://supabase/auth" }, error: null });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
});

describe("feature flag", () => {
  it("is off when the variable is absent", () => {
    expect(isGoogleSignInEnabled({})).toBe(false);
    expect(isGoogleSignInEnabled({ NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN: null })).toBe(false);
  });

  it("is off for any value other than the literal 'true'", () => {
    for (const value of ["", "false", "1", "yes", "TRUE "]) {
      expect(isGoogleSignInEnabled({ NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN: value })).toBe(
        value.trim().toLowerCase() === "true"
      );
    }
  });

  it("is on for 'true' in any casing", () => {
    expect(isGoogleSignInEnabled({ NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN: "true" })).toBe(true);
    expect(isGoogleSignInEnabled({ NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN: " True " })).toBe(true);
  });
});

describe("buildOAuthRedirectTo", () => {
  it("points at this origin's callback route", () => {
    expect(buildOAuthRedirectTo(ORIGIN, null)).toBe(`${ORIGIN}/auth/callback`);
  });

  it("carries a sanitized same-origin next path", () => {
    expect(buildOAuthRedirectTo(ORIGIN, "/profile")).toBe(`${ORIGIN}/auth/callback?next=%2Fprofile`);
  });

  it.each([
    ["an absolute external URL", "https://evil.example/x"],
    ["a protocol-relative URL", "//evil.example"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a backslash trick", "/\\evil.example"],
    ["an encoded protocol-relative URL", "/%2F%2Fevil.example"],
    ["a dot segment that normalises to //host", "/.//evil.example"],
    ["a control character", "/seva\u0000"],
  ])("drops %s", (_label, next) => {
    expect(buildOAuthRedirectTo(ORIGIN, next)).toBe(`${ORIGIN}/auth/callback`);
  });

  it("never produces a URL on another origin", () => {
    const url = new URL(buildOAuthRedirectTo(ORIGIN, "//evil.example"));
    expect(url.origin).toBe(ORIGIN);
  });
});

describe("buildOAuthFailureUrl", () => {
  it("carries only a coarse enum key", () => {
    const url = new URL(buildOAuthFailureUrl(ORIGIN, "exchange_failed"));
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("error")).toBe("exchange_failed");
  });

  it("sanitizes a hostile next into nothing", () => {
    const url = new URL(buildOAuthFailureUrl(ORIGIN, "account_conflict", "//evil.example"));
    expect(url.origin).toBe(ORIGIN);
    expect(url.searchParams.get("redirect")).toBeNull();
  });
});

describe("signInWithGoogle", () => {
  it("does nothing when the flag is off", async () => {
    const outcome = await signInWithGoogle("/", { origin: ORIGIN, env: {} });

    expect(outcome).toEqual({ ok: false, reason: "disabled", message: expect.any(String) });
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
  });

  it("invokes the Supabase Google provider with the callback redirect", async () => {
    const outcome = await signInWithGoogle("/profile", {
      origin: ORIGIN,
      env: { NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN: "true" },
    });

    expect(outcome).toEqual({ ok: true });
    expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1);
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${ORIGIN}/auth/callback?next=%2Fprofile` },
    });
  });

  it("reports a configuration problem instead of starting a doomed flow", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder";

    const outcome = await signInWithGoogle(null, {
      origin: ORIGIN,
      env: { NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN: "true" },
    });

    expect(outcome).toMatchObject({ ok: false, reason: "not_configured" });
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
  });

  it("surfaces a fixed message and never the provider's own error text", async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({
      data: { provider: "google", url: null },
      error: { message: "provider rejected client_id=abc123", code: "oauth_error" },
    });

    const outcome = await signInWithGoogle(null, {
      origin: ORIGIN,
      env: { NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN: "true" },
    });

    expect(outcome).toMatchObject({ ok: false, reason: "unavailable" });
    if (!outcome.ok) {
      expect(outcome.message).not.toMatch(/client_id|abc123/);
    }
  });
});

describe("isAllowedAuthOrigin", () => {
  it.each([
    ["the canonical host", "https://www.srsmathaynk.com"],
    ["the apex host", "https://srsmathaynk.com"],
    ["a vercel preview", "https://rayaramathaynk-git-feat-x.vercel.app"],
    ["local development", "http://localhost:3000"],
    ["loopback", "http://127.0.0.1:3000"],
  ])("accepts %s", (_label, origin) => {
    expect(isAllowedAuthOrigin(origin)).toBe(true);
  });

  it.each([
    ["an unrelated host", "https://evil.example"],
    ["a lookalike suffix", "https://www.srsmathaynk.com.evil.example"],
    ["a plain-http production host", "http://www.srsmathaynk.com"],
    ["a javascript: origin", "javascript:alert(1)"],
    ["a file: origin", "file:///etc/passwd"],
    ["an embedded credential", "https://user:pass@www.srsmathaynk.com"],
    ["a bare word", "not-an-origin"],
    ["a non-vercel lookalike", "https://vercel.app.evil.example"],
  ])("refuses %s", (_label, origin) => {
    expect(isAllowedAuthOrigin(origin)).toBe(false);
  });
});
