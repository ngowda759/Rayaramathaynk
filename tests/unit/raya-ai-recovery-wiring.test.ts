/**
 * Wiring guard for the Raya AI password-recovery flow.
 *
 * The flow must be Supabase-native end to end: request the email with
 * `resetPasswordForEmail`, redeem the link, and write the new password with
 * `updateUser({ password })`. This test fails if any step drifts back onto
 * Firebase, if the reset page stops validating the recovery session before
 * showing the form, or if a service-role key is pulled into a client component.
 */
import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const LOGIN = "app/admin/ai/login/page.tsx";
const FORGOT = "app/admin/ai/forgot-password/page.tsx";
const RESET = "app/admin/ai/reset-password/page.tsx";
const ROUTES = "lib/auth/raya-auth-routes.ts";
const ERRORS = "lib/auth/raya-auth-errors.ts";
const RECOVERY = "lib/auth/raya-password-recovery.ts";

const RECOVERY_PAGES = [FORGOT, RESET];

describe("Raya AI recovery flow is Supabase-native", () => {
  it.each(RECOVERY_PAGES)("%s is a client component on the Supabase client", (file) => {
    const source = read(file);
    expect(source).toMatch(/^\s*["']use client["']/m);
    expect(source).toContain('from "@/lib/supabase/client"');
  });

  it.each([LOGIN, ...RECOVERY_PAGES])("%s never imports or calls Firebase", (file) => {
    const source = read(file);
    expect(source).not.toMatch(/from\s+["'][^"']*firebase/i);
    expect(source).not.toMatch(/require\(\s*["'][^"']*firebase/i);
    expect(source).not.toContain("lib/auth/admin-auth");
    expect(source).not.toContain("admin-firebase");
  });

  it.each([LOGIN, ...RECOVERY_PAGES])("%s never references a service-role key", (file) => {
    const source = read(file);
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("createAdminClient");
  });

  it("the recovery request page uses resetPasswordForEmail with a redirectTo", () => {
    const source = read(FORGOT);
    expect(source).toContain("resetPasswordForEmail");
    expect(source).toContain("redirectTo");
    expect(source).toContain("recoveryRedirectUrl");
    // The acknowledgement must not depend on whether the account exists.
    expect(source).toContain("RECOVERY_REQUEST_ACKNOWLEDGEMENT");
  });

  it("the reset page writes the password with updateUser and no Firebase call", () => {
    const source = read(RESET);
    expect(source).toContain("updateUser({ password })");
    expect(source).toContain("exchangeCodeForSession");
    expect(source).toContain("verifyOtp");
    expect(source).toContain('type: "recovery"');
  });

  it("the reset page validates the recovery session before showing the form", () => {
    const source = read(RESET);
    // The gate must be computed from the pure decision helper, not hand-rolled.
    expect(source).toContain("evaluateRecoveryGate");
    expect(source).toContain("readRecoveryIntent");
    expect(source).toContain("PASSWORD_RECOVERY");
    expect(source).toMatch(/gate\.state === ["']ready["']/);
  });

  it("the reset page reads the credential from the entry URL, not the stripped live URL", () => {
    const source = read(RESET);
    // The SDK redeems a `?code=` link during its own initialization and deletes
    // it from the address bar; reading `window.location` in the page effect loses
    // the credential and produced the "open this page from the reset link" bug.
    expect(source).toContain("getEntryLocationHref");
    expect(source).toContain("hasRecoveryCredential");
    expect(source).toContain("sawRecoveryCredential");
  });

  it("the browser client captures the entry URL at module scope", () => {
    const source = read("lib/supabase/client.ts");
    // Module scope is what makes the capture ordered before any client exists.
    expect(source).toContain("entryLocationHref");
    expect(source).toContain("getEntryLocationHref");
    // The capture must not read anything secret.
    expect(source).not.toMatch(/SERVICE_ROLE|serviceRole/);
  });

  it("the reset page reports a redacted diagnostic and never a credential", () => {
    const source = read(RESET);
    expect(source).toContain("recoveryDiagnosticLine");
    // It must not print a token, code, hash or session object.
    expect(source).not.toMatch(/console\.(log|info)\([^)]*(session|token|code|hash)/i);
  });

  it("the reset page reads the existing session before exchanging the code", () => {
    const source = read(RESET);
    // `getSession()` awaits client initialization, which already redeems a
    // `?code=` link; exchanging again would consume a single-use code twice.
    const sessionIndex = source.indexOf("supabase.auth.getSession()");
    const exchangeIndex = source.indexOf("supabase.auth.exchangeCodeForSession(");
    expect(sessionIndex).toBeGreaterThan(-1);
    expect(exchangeIndex).toBeGreaterThan(sessionIndex);
  });
});

describe("Raya AI auth route constants are the single source of truth", () => {
  it("names the three unauthenticated entry points", () => {
    const source = read(ROUTES);
    expect(source).toContain("login:");
    expect(source).toContain("forgotPassword:");
    expect(source).toContain("resetPassword:");
    expect(source).toContain("isRayaAiPublicAuthPath");
    // The paths themselves are pinned by the pages using the constants.
    for (const suffix of ["/login", "/forgot-password", "/reset-password"]) {
      expect(source).toContain(suffix);
    }
  });

  it("the pages use the constants rather than literal paths", () => {
    for (const file of [LOGIN, FORGOT, RESET]) {
      const source = read(file);
      expect(source).toContain("RAYA_AI_AUTH_ROUTES");
    }
  });

  it("the admin guard asks the shared predicate instead of listing the paths itself", () => {
    const source = read("components/admin/layout/AdminAuthGuard.tsx");
    expect(source).toContain("isRayaAiPublicAuthPath");
  });
});

describe("login and recovery share one error-message vocabulary", () => {
  it("the login page maps failures instead of collapsing them", () => {
    const source = read(LOGIN);
    expect(source).toContain("describeAuthFailure");
    // The old hardcoded message must be gone; the mapping owns the wording.
    expect(source).not.toContain('"Invalid email or password."');
  });

  it("the mapping module keeps the shared invalid-credentials wording", () => {
    expect(read(ERRORS)).toContain("Invalid email or password.");
  });

  it("the recovery logic module owns the link-shape decisions", () => {
    const source = read(RECOVERY);
    expect(source).toContain("readRecoveryIntent");
    expect(source).toContain("evaluateRecoveryGate");
    expect(source).toContain("validateNewPassword");
  });
});
