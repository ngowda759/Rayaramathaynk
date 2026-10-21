/**
 * Pure decision logic for the Raya AI password-recovery page.
 *
 * Supabase can deliver a recovery link in three shapes, and which one arrives
 * depends on the project's email template and the flow type, not on this app:
 *
 * | Shape | Example | How it is redeemed |
 * | --- | --- | --- |
 * | PKCE code | `?code=<uuid>` | `exchangeCodeForSession(code)` - needs the verifier the browser stored when the reset was requested |
 * | OTP token hash | `?token_hash=<hash>&type=recovery` | `verifyOtp({ type: "recovery", token_hash })` - works on any device |
 * | Implicit fragment | `#access_token=...&type=recovery` | the browser client redeems it during initialization and emits `PASSWORD_RECOVERY` |
 *
 * The page must handle all three, and it must refuse to show the form unless the
 * session it holds really came from a recovery link. This module keeps that
 * decision pure so it can be tested without a browser, a network or a session.
 */

export type RecoveryLinkShape = "pkce-code" | "otp-token-hash" | "implicit-fragment" | "none";

export interface RecoveryIntent {
  shape: RecoveryLinkShape;
  /** PKCE authorization code, when present. */
  code: string | null;
  /** OTP token hash, when present. */
  tokenHash: string | null;
  /** True when the URL itself says this is a recovery link. */
  isRecovery: boolean;
  /** Supabase's own error, when it redirected back with a failure instead of a token. */
  errorCode: string | null;
  errorDescription: string | null;
}

const EMPTY_INTENT: RecoveryIntent = {
  shape: "none",
  code: null,
  tokenHash: null,
  isRecovery: false,
  errorCode: null,
  errorDescription: null,
};

/** Query params plus the fragment, so an implicit `#access_token=` link is visible. */
export function readRecoveryIntent(url: string): RecoveryIntent {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return EMPTY_INTENT;
  }

  const params = parsed.searchParams;
  const hashParams = new URLSearchParams(parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash);

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const queryType = params.get("type");
  const hashType = hashParams.get("type");
  const hashHasToken = hashParams.has("access_token") || hashParams.has("refresh_token");
  const errorCode = params.get("error_code") ?? params.get("error");
  const errorDescription = params.get("error_description") ?? hashParams.get("error_description");

  const isRecovery = queryType === "recovery" || hashType === "recovery";

  if (errorCode || errorDescription) {
    return {
      ...EMPTY_INTENT,
      isRecovery,
      errorCode: errorCode ?? "unspecified_error",
      errorDescription,
    };
  }

  if (code) {
    return { ...EMPTY_INTENT, shape: "pkce-code", code, isRecovery: true };
  }
  if (tokenHash) {
    return { ...EMPTY_INTENT, shape: "otp-token-hash", tokenHash, isRecovery };
  }
  if (hashHasToken && hashType === "recovery") {
    return { ...EMPTY_INTENT, shape: "implicit-fragment", isRecovery: true };
  }

  return { ...EMPTY_INTENT, isRecovery };
}

export type RecoveryGateState =
  | { state: "resolving" }
  | { state: "ready" }
  | { state: "error"; message: string }
  | { state: "no-session"; message: string }
  | { state: "not-recovery"; message: string };

const NO_SESSION_MESSAGE =
  "This password reset link is invalid, has expired, or was already used. " +
  "Request a new link and open it in the same browser.";

const NOT_RECOVERY_MESSAGE =
  "Open this page from the password reset link in your email to choose a new password.";

const LINK_ERROR_MESSAGE =
  "That password reset link could not be used. Request a new link and try again.";

/**
 * Decide what the reset page may show.
 *
 * `hasSession` is the live Supabase session; `recoveryVerified` is true only when
 * this page actually redeemed a recovery link (PKCE exchange, `verifyOtp`, a
 * `PASSWORD_RECOVERY` event, or a recovery-marked URL at load). Both are required:
 * a session alone is not proof that the person arrived through a reset link.
 */
export function evaluateRecoveryGate(input: {
  resolving: boolean;
  hasSession: boolean;
  recoveryVerified: boolean;
  linkError: boolean;
}): RecoveryGateState {
  if (input.resolving) return { state: "resolving" };
  if (input.linkError) return { state: "error", message: LINK_ERROR_MESSAGE };
  if (!input.hasSession) return { state: "no-session", message: NO_SESSION_MESSAGE };
  if (!input.recoveryVerified) return { state: "not-recovery", message: NOT_RECOVERY_MESSAGE };
  return { state: "ready" };
}

export const RECOVERY_GATE_MESSAGES = {
  noSession: NO_SESSION_MESSAGE,
  notRecovery: NOT_RECOVERY_MESSAGE,
  linkError: LINK_ERROR_MESSAGE,
} as const;

export interface PasswordValidation {
  ok: boolean;
  error?: string;
}

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Client-side password rules. The server is still the authority (Supabase
 * enforces its own policy and answers `weak_password`); this only spares a round
 * trip for the obvious cases.
 */
export function validateNewPassword(password: string, confirmation: string): PasswordValidation {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirmation) {
    return { ok: false, error: "The two passwords do not match." };
  }
  return { ok: true };
}

/** The absolute address a recovery email should return to. */
export function recoveryRedirectUrl(origin: string, resetPath: string): string {
  return `${origin.replace(/\/+$/, "")}${resetPath}`;
}
