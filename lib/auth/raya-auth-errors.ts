/**
 * Turns a Supabase Auth failure into a message a person can act on, without
 * leaking anything the server would not already tell an anonymous caller.
 *
 * Why this exists: the Raya AI sign-in page used to collapse *every* failure -
 * a wrong password, an unconfirmed email, a rate limit, a network error, or an
 * unconfigured deployment - into "Invalid email or password." That message is
 * actively misleading for the non-credential cases (the reported production
 * symptom) and it hides a deployment misconfiguration behind a password prompt.
 *
 * Two rules are load-bearing:
 *
 * 1. **No account enumeration.** `signInWithPassword` answers `invalid_credentials`
 *    for both an unknown email and a wrong password, so the two are deliberately
 *    reported with the same message. Password recovery always reports success,
 *    whatever the server says, for the same reason.
 * 2. **No secrets in the output.** Only a fixed message per code is returned; the
 *    raw error text (which can echo a request id or a URL) is never shown.
 *
 * The module is pure so every branch is unit-testable without a network.
 */

/** The subset of a Supabase Auth error this module needs. */
export interface SupabaseAuthErrorLike {
  message?: string | null;
  code?: string | null;
  status?: number | null;
  name?: string | null;
}

export type AuthFailureContext = "sign-in" | "recovery-request" | "password-update";

/** How the caller should react, so a UI can distinguish "retry" from "fix your input". */
export type AuthFailureKind =
  | "invalid-credentials"
  | "email-not-confirmed"
  | "rate-limited"
  | "weak-password"
  | "same-password"
  | "session-expired"
  | "network"
  | "not-configured"
  | "unknown";

export interface AuthFailureMessage {
  kind: AuthFailureKind;
  message: string;
}

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";
const NETWORK_MESSAGE =
  "Could not reach the authentication service. Check your connection and try again.";
const UNKNOWN_MESSAGE = "Something went wrong. Please try again.";

/** True when the failure is a transport/availability problem rather than a rejected credential. */
function isTransportFailure(error: SupabaseAuthErrorLike): boolean {
  const name = error.name ?? "";
  const code = error.code ?? "";
  return (
    name === "AuthRetryableFetchError" ||
    name === "AuthUnknownError" ||
    code === "request_timeout" ||
    code === "unexpected_failure" ||
    error.status === 0 ||
    error.status === 502 ||
    error.status === 503 ||
    error.status === 504
  );
}

/**
 * Map a Supabase Auth error to a safe message. `notConfigured` takes precedence
 * because a placeholder client cannot produce a meaningful server error at all.
 */
export function describeAuthFailure(
  error: SupabaseAuthErrorLike | null | undefined,
  context: AuthFailureContext,
  options: { notConfigured?: boolean } = {}
): AuthFailureMessage {
  if (options.notConfigured) {
    return {
      kind: "not-configured",
      message:
        "Supabase authentication is not configured in this deployment. " +
        "Please contact an administrator.",
    };
  }

  if (!error) {
    return { kind: "unknown", message: UNKNOWN_MESSAGE };
  }

  const code = error.code ?? "";
  const message = error.message ?? "";

  switch (code) {
    case "invalid_credentials":
      // Same wording for an unknown email and a wrong password: no enumeration.
      return { kind: "invalid-credentials", message: INVALID_CREDENTIALS_MESSAGE };

    case "email_not_confirmed":
      return {
        kind: "email-not-confirmed",
        message:
          "This email address has not been confirmed yet. " +
          "Confirm it, then sign in again.",
      };

    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return {
        kind: "rate-limited",
        message: "Too many attempts. Please wait a moment and try again.",
      };

    case "weak_password":
      return {
        kind: "weak-password",
        message: "That password is too weak. Use at least 8 characters.",
      };

    case "same_password":
      return {
        kind: "same-password",
        message: "The new password must be different from the current one.",
      };

    case "session_not_found":
    case "refresh_token_not_found":
    case "refresh_token_already_used":
      return {
        kind: "session-expired",
        message: "Your reset link has expired or was already used. Request a new one.",
      };
  }

  // A missing session is reported by the SDK as an AuthSessionMissingError with
  // no code, so the name is the only signal.
  if (error.name === "AuthSessionMissingError") {
    return {
      kind: "session-expired",
      message: "Your reset link has expired or was already used. Request a new one.",
    };
  }

  if (isTransportFailure(error)) {
    return { kind: "network", message: NETWORK_MESSAGE };
  }

  if (context === "sign-in" && /invalid login credentials/i.test(message)) {
    return { kind: "invalid-credentials", message: INVALID_CREDENTIALS_MESSAGE };
  }

  return { kind: "unknown", message: UNKNOWN_MESSAGE };
}

/**
 * Narrow an `unknown` thrown value to the shape this module understands, so
 * callers never need an `as` cast and a non-error value cannot crash the UI.
 */
export function toAuthErrorLike(error: unknown): SupabaseAuthErrorLike | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as Record<string, unknown>;
  return {
    message: typeof candidate.message === "string" ? candidate.message : null,
    code: typeof candidate.code === "string" ? candidate.code : null,
    status: typeof candidate.status === "number" ? candidate.status : null,
    name: typeof candidate.name === "string" ? candidate.name : null,
  };
}

/**
 * The message shown after a password-recovery request, whatever the server
 * answered. A distinguishable "no such account" reply would let an anonymous
 * caller test whether an address is a Raya AI administrator.
 */
export const RECOVERY_REQUEST_ACKNOWLEDGEMENT =
  "If that email belongs to an administrator account, a password reset link is on its way. " +
  "Check your inbox and spam folder.";
