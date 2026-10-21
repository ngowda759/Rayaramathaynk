/**
 * The redacted recovery diagnostic must never carry a credential.
 *
 * These tests are the guard rail for that promise: they feed the module values
 * that *look* like secrets and assert none of them can reach the output, because
 * the input type is booleans and the output is a fixed vocabulary.
 */
import {
  recoveryDiagnosticAdvice,
  recoveryDiagnosticLine,
  recoveryDiagnosticReason,
  type RecoveryDiagnosticFacts,
} from "@/lib/auth/raya-recovery-diagnostics";

const base: RecoveryDiagnosticFacts = {
  linkShape: "pkce-code",
  sawCredential: true,
  hasSession: true,
  recoveryVerified: false,
  linkError: false,
  exchangeFailed: false,
  configOk: true,
};

describe("recoveryDiagnosticReason", () => {
  it("is ready when a session came from an observed credential", () => {
    expect(recoveryDiagnosticReason(base)).toBe("ready");
  });

  it("names a missing configuration first", () => {
    expect(recoveryDiagnosticReason({ ...base, configOk: false })).toBe("link-error");
  });

  it("distinguishes an expired link from a rejected redirect", () => {
    expect(recoveryDiagnosticReason({ ...base, exchangeFailed: true })).toBe("expired-link");
    expect(
      recoveryDiagnosticReason({ ...base, linkError: true, hasSession: false })
    ).toBe("link-error");
  });

  it("names a missing session", () => {
    expect(recoveryDiagnosticReason({ ...base, hasSession: false })).toBe("no-session");
  });

  it("names a non-recovery session", () => {
    expect(
      recoveryDiagnosticReason({ ...base, sawCredential: false, linkShape: "none" })
    ).toBe("not-recovery");
  });
});

describe("recoveryDiagnosticLine", () => {
  it("reports categories and booleans only", () => {
    const line = recoveryDiagnosticLine(base);
    expect(line).toContain("reason=ready");
    expect(line).toContain("link=pkce-code");
    expect(line).toContain("credential=present");
    expect(line).toContain("session=present");
    expect(line).toContain("config=ok");
  });

  it("cannot contain a credential, whatever the facts say", () => {
    // Every field is a boolean or a member of a closed union, so no input can
    // smuggle a value through. Assert the shape of the output directly.
    const line = recoveryDiagnosticLine({
      ...base,
      linkShape: "otp-token-hash",
      sawCredential: true,
    });
    expect(line).not.toMatch(/token_hash|access_token|refresh_token|code=|bearer/i);
  });
});

describe("recoveryDiagnosticAdvice", () => {
  it("tells a no-credential arrival to open the email link", () => {
    expect(
      recoveryDiagnosticAdvice({ ...base, sawCredential: false, linkShape: "none", hasSession: false })
    ).toMatch(/no recovery credential/i);
  });

  it("tells a non-recovery session that the address was not opened from a link", () => {
    expect(
      recoveryDiagnosticAdvice({ ...base, sawCredential: false, linkShape: "none" })
    ).toMatch(/not opened from a reset link/i);
  });

  it("tells a credential-but-no-session arrival to use the same browser", () => {
    expect(recoveryDiagnosticAdvice({ ...base, hasSession: false })).toMatch(/same browser/i);
  });

  it("says nothing when the form is ready", () => {
    expect(recoveryDiagnosticAdvice(base)).toBe("");
  });
});
