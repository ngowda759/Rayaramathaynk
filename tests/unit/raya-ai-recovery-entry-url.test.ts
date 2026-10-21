/**
 * Regression: a PKCE recovery link must not be reported as "open this page from
 * the password reset link in your email".
 *
 * The production failure was an ordering race, not a wrong credential:
 *
 * 1. `app/admin/layout.tsx` wraps every admin page in `AdminAuthGuard`.
 * 2. The guard mounts *before* the page and calls `useSupabaseSession()`, which
 *    calls `createClient()`.
 * 3. `createBrowserClient` returns a singleton whose SDK **auto-initializes in
 *    its constructor** (`GoTrueClient` calls `this.initialize()`), so a `?code=`
 *    recovery link is redeemed during step 2.
 * 4. The SDK then deletes `?code=` from the address bar
 *    (`_getSessionFromURL` -> `url.searchParams.delete('code')` +
 *    `history.replaceState`).
 * 5. The reset page's own effect runs only after the guard stops loading, reads
 *    `window.location`, and finds no credential. With a session present and no
 *    provenance it renders `not-recovery` - the reported message.
 *
 * These tests drive the real `@supabase/ssr` client against a stubbed fetch, so
 * they fail if the SDK's redemption behaviour changes, not merely if our helper
 * does. No real credential is used: the "code" is a literal and the token is a
 * locally forged, unsigned JWT.
 *
 * @jest-environment jsdom
 */
import { readRecoveryIntent, evaluateRecoveryGate, hasRecoveryCredential } from "@/lib/auth/raya-password-recovery";

function b64url(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

const ACCESS_TOKEN = [
  b64url({ alg: "HS256", typ: "JWT" }),
  b64url({ sub: "u1", email: "admin@example.org", exp: Math.floor(Date.now() / 1000) + 3600 }),
  "signature",
].join(".");

const USER = { id: "u1", email: "admin@example.org", aud: "authenticated", role: "authenticated" };

const SUPABASE_URL = "https://abcdefghijklmnop.supabase.co";
const ANON_KEY = "test-anon-key";
const RESET_PATH = "/admin/ai/reset-password";

let exchangedUrls: string[] = [];

function installFetch() {
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    );
    exchangedUrls.push(url);
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    if (url.includes("/token?grant_type=pkce")) {
      return json({
        access_token: ACCESS_TOKEN,
        refresh_token: "refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user: USER,
      });
    }
    if (url.includes("/user")) return json(USER);
    return json({});
  }) as typeof fetch;
}

beforeEach(() => {
  exchangedUrls = [];
  document.cookie = "";
  jest.resetModules();
  installFetch();
  window.history.replaceState(null, "", RESET_PATH);
});

describe("Supabase SDK recovery-link redemption (real client)", () => {
  it("strips ?code= from the URL during client construction, before any page effect", async () => {
    // The reset was requested from this browser, so the PKCE verifier is stored.
    {
      const { createBrowserClient } = require("@supabase/ssr");
      const requester = createBrowserClient(SUPABASE_URL, ANON_KEY);
      await requester.auth.resetPasswordForEmail("admin@example.org", {
        redirectTo: `http://localhost${RESET_PATH}`,
      });
      expect(document.cookie).toContain("code-verifier");
    }

    // A real navigation starts a fresh JS context, so re-require the modules.
    jest.resetModules();
    installFetch();
    window.history.replaceState(null, "", `${RESET_PATH}?code=RECOVERY-CODE-xyz`);

    const { createBrowserClient } = require("@supabase/ssr");
    const { getEntryLocationHref } = require("@/lib/supabase/client");

    // AdminAuthGuard mounts first and creates the singleton.
    const guardClient = createBrowserClient(SUPABASE_URL, ANON_KEY);
    const { data: guardSession } = await guardClient.auth.getSession();

    // The credential really was redeemed, and really is gone from the URL.
    expect(exchangedUrls.some((u) => u.includes("grant_type=pkce"))).toBe(true);
    expect(guardSession.session).not.toBeNull();
    expect(window.location.href).not.toContain("code=");

    // The reset page then runs. Reading the live URL alone would lose the link.
    const liveUrl = window.location.href;
    const entryUrl = getEntryLocationHref() ?? liveUrl;

    expect(readRecoveryIntent(liveUrl).shape).toBe("none");
    expect(readRecoveryIntent(entryUrl).shape).toBe("pkce-code");
    expect(hasRecoveryCredential(entryUrl)).toBe(true);
  });
});

describe("the recovery gate after the SDK has consumed the credential", () => {
  /**
   * This is the exact input the page produces in production: a session exists,
   * the page never performed the exchange itself (so `recoveryVerified` is
   * false), but the credential was observed at entry.
   */
  it("opens the form instead of showing the 'open this page from the link' message", () => {
    const gate = evaluateRecoveryGate({
      resolving: false,
      hasSession: true,
      recoveryVerified: false,
      sawRecoveryCredential: true,
      linkError: false,
      exchangeFailed: false,
    });
    expect(gate.state).toBe("ready");
  });

  it("still refuses an ordinary signed-in visitor who typed the address", () => {
    const gate = evaluateRecoveryGate({
      resolving: false,
      hasSession: true,
      recoveryVerified: false,
      sawRecoveryCredential: false,
      linkError: false,
      exchangeFailed: false,
    });
    expect(gate.state).toBe("not-recovery");
  });
});
