/**
 * The pure password-recovery decisions: which link shape arrived, whether the
 * reset page may show the form, and the client-side password rules.
 *
 * The link shape matters because Supabase can deliver a recovery link as a PKCE
 * `?code=`, an OTP `?token_hash=`, or an implicit `#access_token=` fragment, and
 * the page must not try to redeem the same credential twice.
 */
import {
  readRecoveryIntent,
  evaluateRecoveryGate,
  validateNewPassword,
  recoveryRedirectUrl,
  RECOVERY_GATE_MESSAGES,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/raya-password-recovery";

const ORIGIN = "https://www.example.org";

describe("readRecoveryIntent", () => {
  it("recognizes a PKCE code link", () => {
    const intent = readRecoveryIntent(`${ORIGIN}/admin/ai/reset-password?code=abc-123`);
    expect(intent.shape).toBe("pkce-code");
    expect(intent.code).toBe("abc-123");
    expect(intent.isRecovery).toBe(true);
  });

  it("recognizes an OTP token-hash recovery link", () => {
    const intent = readRecoveryIntent(
      `${ORIGIN}/admin/ai/reset-password?token_hash=hash-1&type=recovery`
    );
    expect(intent.shape).toBe("otp-token-hash");
    expect(intent.tokenHash).toBe("hash-1");
    expect(intent.isRecovery).toBe(true);
  });

  it("recognizes an implicit fragment link", () => {
    const intent = readRecoveryIntent(
      `${ORIGIN}/admin/ai/reset-password#access_token=tok&refresh_token=r&type=recovery`
    );
    expect(intent.shape).toBe("implicit-fragment");
    expect(intent.isRecovery).toBe(true);
  });

  it("does not treat an unrelated access_token fragment as a recovery link", () => {
    const intent = readRecoveryIntent(`${ORIGIN}/admin/ai/reset-password#access_token=tok`);
    expect(intent.shape).toBe("none");
    expect(intent.isRecovery).toBe(false);
  });

  it("surfaces a redirect error instead of a token", () => {
    const intent = readRecoveryIntent(
      `${ORIGIN}/admin/ai/reset-password?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid`
    );
    expect(intent.errorCode).toBe("otp_expired");
    expect(intent.errorDescription).toMatch(/invalid/i);
    expect(intent.shape).toBe("none");
  });

  it("reports nothing for a plain visit", () => {
    const intent = readRecoveryIntent(`${ORIGIN}/admin/ai/reset-password`);
    expect(intent.shape).toBe("none");
    expect(intent.isRecovery).toBe(false);
    expect(intent.errorCode).toBeNull();
  });

  it("does not throw on an unparseable URL", () => {
    expect(readRecoveryIntent("::::").shape).toBe("none");
  });

  it("prefers a code over a token hash when both are present", () => {
    const intent = readRecoveryIntent(
      `${ORIGIN}/admin/ai/reset-password?code=c&token_hash=t&type=recovery`
    );
    expect(intent.shape).toBe("pkce-code");
  });
});

describe("evaluateRecoveryGate", () => {
  it("stays resolving while the link is being checked", () => {
    expect(
      evaluateRecoveryGate({
        resolving: true,
        hasSession: false,
        recoveryVerified: false,
        sawRecoveryCredential: false,
        linkError: false,
        exchangeFailed: false,
      }).state
    ).toBe("resolving");
  });

  it("reports a link error before anything else", () => {
    const gate = evaluateRecoveryGate({
      resolving: false,
      hasSession: true,
      recoveryVerified: true,
      sawRecoveryCredential: true,
      linkError: true,
      exchangeFailed: false,
    });
    expect(gate.state).toBe("error");
    if (gate.state === "error") expect(gate.reason).toBe("link-error");
  });

  it("refuses the form when there is no session", () => {
    const gate = evaluateRecoveryGate({
      resolving: false,
      hasSession: false,
      recoveryVerified: false,
      sawRecoveryCredential: true,
      linkError: false,
      exchangeFailed: false,
    });
    expect(gate.state).toBe("no-session");
    if (gate.state === "no-session") {
      expect(gate.message).toBe(RECOVERY_GATE_MESSAGES.noSession);
      expect(gate.reason).toBe("no-session");
    }
  });

  it("refuses the form for an ordinary session that did not come from a recovery link", () => {
    const gate = evaluateRecoveryGate({
      resolving: false,
      hasSession: true,
      recoveryVerified: false,
      sawRecoveryCredential: false,
      linkError: false,
      exchangeFailed: false,
    });
    expect(gate.state).toBe("not-recovery");
    if (gate.state === "not-recovery") expect(gate.reason).toBe("not-recovery");
  });

  it("reports an expired link distinctly from a rejected redirect", () => {
    const gate = evaluateRecoveryGate({
      resolving: false,
      hasSession: false,
      recoveryVerified: false,
      sawRecoveryCredential: true,
      linkError: false,
      exchangeFailed: true,
    });
    expect(gate.state).toBe("error");
    if (gate.state === "error") expect(gate.reason).toBe("expired-link");
  });

  it("opens the form for a verified recovery session", () => {
    const gate = evaluateRecoveryGate({
      resolving: false,
      hasSession: true,
      recoveryVerified: true,
      sawRecoveryCredential: true,
      linkError: false,
      exchangeFailed: false,
    });
    expect(gate.state).toBe("ready");
  });

  /**
   * The production failure: the SDK redeems a `?code=` link during its own
   * initialization and erases it from the address bar, so the page's effect sees
   * a stripped URL. The credential was *observed* at entry even though the
   * exchange was performed by the SDK, not by the page, so `recoveryVerified`
   * stays false. A session plus an observed credential must still open the form.
   */
  it("opens the form when the SDK consumed the credential before the page could verify it", () => {
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
});

describe("validateNewPassword", () => {
  it("rejects a short password", () => {
    const result = validateNewPassword("short", "short");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(new RegExp(String(MIN_PASSWORD_LENGTH)));
  });

  it("rejects a mismatch", () => {
    const result = validateNewPassword("longenough1", "longenough2");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/do not match/i);
  });

  it("accepts a long matching password", () => {
    expect(validateNewPassword("longenough1", "longenough1").ok).toBe(true);
  });
});

describe("recoveryRedirectUrl", () => {
  it("joins the origin and path without doubling slashes", () => {
    expect(recoveryRedirectUrl("https://x.org/", "/admin/ai/reset-password")).toBe(
      "https://x.org/admin/ai/reset-password"
    );
  });

  it("keeps a bare origin intact", () => {
    expect(recoveryRedirectUrl("https://x.org", "/admin/ai/reset-password")).toBe(
      "https://x.org/admin/ai/reset-password"
    );
  });
});
