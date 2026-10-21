/**
 * The Raya AI sign-in failure messages.
 *
 * The reported production bug was that *every* failure was shown as "Invalid
 * email or password." These tests pin the mapping that replaced it: a rejected
 * credential, an unconfirmed email, a rate limit, a weak password and a
 * transport failure must each be distinguishable, and an unknown email must be
 * indistinguishable from a wrong password (no account enumeration).
 */
import {
  describeAuthFailure,
  toAuthErrorLike,
  RECOVERY_REQUEST_ACKNOWLEDGEMENT,
} from "@/lib/auth/raya-auth-errors";

const INVALID = "Invalid email or password.";

describe("describeAuthFailure — credential failures", () => {
  it("maps invalid_credentials to the shared wording", () => {
    const result = describeAuthFailure(
      { code: "invalid_credentials", message: "Invalid login credentials", status: 400 },
      "sign-in"
    );
    expect(result.kind).toBe("invalid-credentials");
    expect(result.message).toBe(INVALID);
  });

  it("never distinguishes an unknown email from a wrong password", () => {
    // Supabase answers the same code for both; the wording must not leak which.
    const unknownEmail = describeAuthFailure(
      { code: "invalid_credentials", message: "Invalid login credentials" },
      "sign-in"
    );
    const wrongPassword = describeAuthFailure(
      { code: "invalid_credentials", message: "Invalid login credentials" },
      "sign-in"
    );
    expect(unknownEmail.message).toBe(wrongPassword.message);
  });

  it("still maps the wording when only the message is present", () => {
    const result = describeAuthFailure({ message: "Invalid login credentials" }, "sign-in");
    expect(result.kind).toBe("invalid-credentials");
  });
});

describe("describeAuthFailure — non-credential failures are not called a bad password", () => {
  it("reports an unconfirmed email as such", () => {
    const result = describeAuthFailure({ code: "email_not_confirmed" }, "sign-in");
    expect(result.kind).toBe("email-not-confirmed");
    expect(result.message).not.toBe(INVALID);
    expect(result.message).toMatch(/not been confirmed/i);
  });

  it("reports a rate limit", () => {
    expect(describeAuthFailure({ code: "over_request_rate_limit" }, "sign-in").kind).toBe(
      "rate-limited"
    );
    expect(describeAuthFailure({ code: "over_email_send_rate_limit" }, "recovery-request").kind).toBe(
      "rate-limited"
    );
  });

  it("reports a weak password on the update step", () => {
    const result = describeAuthFailure({ code: "weak_password" }, "password-update");
    expect(result.kind).toBe("weak-password");
    expect(result.message).toMatch(/8 characters/);
  });

  it("reports reusing the same password on the update step", () => {
    const result = describeAuthFailure({ code: "same_password" }, "password-update");
    expect(result.kind).toBe("same-password");
  });

  it("reports an expired or reused reset link", () => {
    const result = describeAuthFailure(
      { name: "AuthSessionMissingError", message: "Auth session missing!" },
      "password-update"
    );
    expect(result.kind).toBe("session-expired");
    expect(result.message).toMatch(/expired or was already used/i);
  });

  it("reports a transport failure as a network problem, never as bad credentials", () => {
    const result = describeAuthFailure(
      { name: "AuthRetryableFetchError", message: "Failed to fetch", status: 0 },
      "sign-in"
    );
    expect(result.kind).toBe("network");
    expect(result.message).not.toBe(INVALID);
    expect(result.message).toMatch(/could not reach/i);
  });

  it("treats a 503 from the auth service as a network problem", () => {
    expect(describeAuthFailure({ status: 503, message: "Service Unavailable" }, "sign-in").kind).toBe(
      "network"
    );
  });
});

describe("describeAuthFailure — configuration and unknown", () => {
  it("reports an unconfigured deployment ahead of any server error", () => {
    const result = describeAuthFailure(
      { code: "invalid_credentials" },
      "sign-in",
      { notConfigured: true }
    );
    expect(result.kind).toBe("not-configured");
    expect(result.message).toMatch(/not configured/i);
    expect(result.message).not.toBe(INVALID);
  });

  it("falls back to a generic message for an unrecognized error", () => {
    const result = describeAuthFailure({ message: "something odd" }, "sign-in");
    expect(result.kind).toBe("unknown");
    expect(result.message).toBe("Something went wrong. Please try again.");
  });

  it("handles a null error without throwing", () => {
    expect(describeAuthFailure(null, "sign-in").kind).toBe("unknown");
  });

  it("never echoes the raw server message, which can carry request detail", () => {
    const result = describeAuthFailure(
      { code: "unexpected_failure", message: "Internal error: request id abc123 token eyJhbGci" },
      "sign-in"
    );
    expect(result.message).not.toMatch(/abc123|eyJhbGci/);
  });
});

describe("toAuthErrorLike", () => {
  it("narrows a thrown Error to the fields used", () => {
    const error = Object.assign(new Error("boom"), { code: "invalid_credentials", status: 400 });
    expect(toAuthErrorLike(error)).toEqual({
      message: "boom",
      code: "invalid_credentials",
      status: 400,
      name: "Error",
    });
  });

  it("returns null for a non-object throw", () => {
    expect(toAuthErrorLike("a string")).toBeNull();
    expect(toAuthErrorLike(undefined)).toBeNull();
  });

  it("ignores fields of the wrong type rather than passing them through", () => {
    expect(toAuthErrorLike({ message: 42, code: {}, status: "400" })).toEqual({
      message: null,
      code: null,
      status: null,
      name: null,
    });
  });
});

describe("recovery acknowledgement", () => {
  it("does not confirm whether the address exists", () => {
    expect(RECOVERY_REQUEST_ACKNOWLEDGEMENT).toMatch(/^If that email belongs/);
    expect(RECOVERY_REQUEST_ACKNOWLEDGEMENT).not.toMatch(/no account|not found|does not exist/i);
  });
});
