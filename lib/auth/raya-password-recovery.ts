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
  | { state: "error"; reason: RecoveryFailureReason; message: string }
  | { state: "no-session"; reason: RecoveryFailureReason; message: string }
  | { state: "not-recovery"; reason: RecoveryFailureReason; message: string };

/**
 * Why the reset form is not available. Safe to log or display: it names a
 * *category* of failure and never a token, code, hash or session credential.
 * It exists so a support report can say "expired link" instead of "it did not
 * work", which is what the page could not previously distinguish.
 */
export type RecoveryFailureReason =
  /** The redirect itself carried an error, or the credential was rejected. */
  | "link-error"
  /** The credential was already used or has aged out. */
  | "expired-link"
  /** The link was accepted but produced no session (e.g. opened in another browser). */
  | "no-session"
  /** A session exists, but it was not established by a recovery link. */
  | "not-recovery";

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
 * a recovery link was actually redeemed for this page (a `PASSWORD_RECOVERY`
 * event, a code/OTP this page exchanged, or a recovery-marked URL the page saw
 * *before* the SDK stripped it).
 *
 * A session alone is not proof that the person arrived through a reset link -
 * an ordinary signed-in administrator who opens this address must not be shown a
 * password form - but it *is* proof when the page also observed the recovery
 * credential. `sawRecoveryCredential` covers the case where the SDK redeemed the
 * link during initialization and removed `?code=` before this page could read
 * the URL: the page records the credential's presence at mount, then pairs that
 * record with the session the redemption produced.
 */
export function evaluateRecoveryGate(input: {
  resolving: boolean;
  hasSession: boolean;
  recoveryVerified: boolean;
  /** True when a recovery credential (code, token_hash or recovery fragment) was present in the URL at mount. */
  sawRecoveryCredential: boolean;
  linkError: boolean;
  /** True when the credential was present but the exchange reported it unusable. */
  exchangeFailed: boolean;
}): RecoveryGateState {
  if (input.resolving) return { state: "resolving" };
  if (input.linkError) {
    return { state: "error", reason: "link-error", message: LINK_ERROR_MESSAGE };
  }
  if (input.exchangeFailed) {
    return { state: "error", reason: "expired-link", message: LINK_ERROR_MESSAGE };
  }
  if (!input.hasSession) {
    return { state: "no-session", reason: "no-session", message: NO_SESSION_MESSAGE };
  }
  // A session plus an observed recovery credential is a recovery session: the
  // credential was consumed by the SDK's initialization, and only the browser
  // that requested the reset holds the PKCE verifier that made it work.
  if (!input.recoveryVerified && !input.sawRecoveryCredential) {
    return { state: "not-recovery", reason: "not-recovery", message: NOT_RECOVERY_MESSAGE };
  }
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

/**
 * True when the URL carries something that can only be a recovery credential:
 * a PKCE `code`, an OTP `token_hash`, or an implicit `#access_token=` fragment.
 *
 * The reset page calls this against the address the document was *entered* with,
 * because the Supabase SDK redeems a PKCE code or fragment during its
 * initialization and erases it from `window.location` before the page's effect
 * runs. Reading the live URL at that point would always say "no credential",
 * which is the bug this predicate exists to avoid.
 *
 * It reports presence only - the credential's value is never returned, logged or
 * compared.
 */
export function hasRecoveryCredential(url: string | null | undefined): boolean {
  if (!url) return false;
  const intent = readRecoveryIntent(url);
  return intent.shape !== "none";
}
