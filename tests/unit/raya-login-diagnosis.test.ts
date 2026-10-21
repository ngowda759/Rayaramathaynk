/**
 * The read-only Raya AI administrator sign-in diagnosis.
 *
 * `signInWithPassword` cannot distinguish an unknown email from a wrong password,
 * so the client can never explain a failure. This module does, from the account's
 * structural facts, and these tests pin each verdict - including that a
 * structurally-correct account with a wrong password is reported as such rather
 * than as a missing account (which would invite a pointless re-create).
 */
import {
  diagnoseRayaAdminLogin,
  ALLOWED_ROLES,
  type AuthUserLike,
  type AuthorizationRowLike,
} from "../../scripts/lib/raya-login-diagnosis";

const EMAIL = "admin@example.org";

function authUser(over: Partial<AuthUserLike> = {}): AuthUserLike {
  return {
    id: "auth-1",
    email: EMAIL,
    providers: ["email"],
    email_confirmed_at: "2026-01-01T00:00:00Z",
    recovery_sent_at: null,
    last_sign_in_at: null,
    ...over,
  };
}

function profile(over: Partial<AuthorizationRowLike> = {}): AuthorizationRowLike {
  return {
    id: "profile-1",
    email: EMAIL,
    role: "super_admin",
    active: true,
    auth_user_id: "auth-1",
    ...over,
  };
}

describe("diagnoseRayaAdminLogin — account structure", () => {
  it("reports ok for a linked, active, allowed account", () => {
    const result = diagnoseRayaAdminLogin({ email: EMAIL, authUsers: [authUser()], profiles: [profile()] });
    expect(result.verdict).toBe("ok");
    expect(result.summary).toMatch(/stored password does not match/i);
  });

  it("is case-insensitive about the email", () => {
    const result = diagnoseRayaAdminLogin({
      email: "ADMIN@Example.org",
      authUsers: [authUser()],
      profiles: [profile()],
    });
    expect(result.verdict).toBe("ok");
  });

  it("reports no-auth-user when nothing matches", () => {
    const result = diagnoseRayaAdminLogin({ email: EMAIL, authUsers: [], profiles: [] });
    expect(result.verdict).toBe("no-auth-user");
  });

  it("fails closed on duplicate Auth accounts", () => {
    const result = diagnoseRayaAdminLogin({
      email: EMAIL,
      authUsers: [authUser({ id: "a" }), authUser({ id: "b" })],
      profiles: [profile()],
    });
    expect(result.verdict).toBe("ambiguous-auth-user");
  });

  it("reports a missing email identity", () => {
    const result = diagnoseRayaAdminLogin({
      email: EMAIL,
      authUsers: [authUser({ providers: ["google"] })],
      profiles: [profile()],
    });
    expect(result.verdict).toBe("no-password-identity");
  });

  it("reports a missing authorization row", () => {
    const result = diagnoseRayaAdminLogin({ email: EMAIL, authUsers: [authUser()], profiles: [] });
    expect(result.verdict).toBe("no-profile");
  });

  it("reports an unlinked authorization row", () => {
    const result = diagnoseRayaAdminLogin({
      email: EMAIL,
      authUsers: [authUser()],
      profiles: [profile({ auth_user_id: null })],
    });
    expect(result.verdict).toBe("profile-not-linked");
  });

  it("reports a row linked to a different Auth account", () => {
    const result = diagnoseRayaAdminLogin({
      email: EMAIL,
      authUsers: [authUser({ id: "auth-1" })],
      profiles: [profile({ auth_user_id: "auth-other" })],
    });
    expect(result.verdict).toBe("profile-linked-elsewhere");
  });

  it("reports an inactive account", () => {
    const result = diagnoseRayaAdminLogin({
      email: EMAIL,
      authUsers: [authUser()],
      profiles: [profile({ active: false })],
    });
    expect(result.verdict).toBe("inactive");
  });

  it("reports a role outside the allow-list", () => {
    const result = diagnoseRayaAdminLogin({
      email: EMAIL,
      authUsers: [authUser()],
      profiles: [profile({ role: "devotee" })],
    });
    expect(result.verdict).toBe("role-not-allowed");
  });

  it("accepts every allow-listed role", () => {
    for (const role of ALLOWED_ROLES) {
      const result = diagnoseRayaAdminLogin({
        email: EMAIL,
        authUsers: [authUser()],
        profiles: [profile({ role })],
      });
      expect(result.verdict).toBe("ok");
    }
  });

  it("notes an unconfirmed email without treating it as the verdict", () => {
    const result = diagnoseRayaAdminLogin({
      email: EMAIL,
      authUsers: [authUser({ email_confirmed_at: null })],
      profiles: [profile()],
    });
    expect(result.verdict).toBe("ok");
    expect(result.facts.join(" ")).toMatch(/NOT confirmed/);
  });

  it("notes a recovery email that was already sent", () => {
    const result = diagnoseRayaAdminLogin({
      email: EMAIL,
      authUsers: [authUser({ recovery_sent_at: "2026-10-21T00:00:00Z" })],
      profiles: [profile()],
    });
    expect(result.facts.join(" ")).toMatch(/recovery email was sent/);
  });

  it("never puts a credential-looking value in the report", () => {
    const result = diagnoseRayaAdminLogin({ email: EMAIL, authUsers: [authUser()], profiles: [profile()] });
    const text = `${result.summary} ${result.facts.join(" ")}`;
    expect(text).not.toMatch(/password[:=]\s*\S+/i);
    expect(text).not.toMatch(/eyJ[A-Za-z0-9._-]{10,}/);
  });
});
