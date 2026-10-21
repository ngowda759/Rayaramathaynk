/**
 * A redacted summary of why a password-reset link could not be used.
 *
 * The reset page previously had one message for every failure, so a support
 * report could not distinguish "the link expired" from "the link was opened in a
 * different browser" from "the deployment is missing its Supabase variables".
 * This module produces a summary that *is* safe to show on screen and to write
 * to the console: it carries categories and booleans, never a credential.
 *
 * Hard rules, enforced by the unit tests:
 *
 * - No `code`, `token_hash`, `access_token`, `refresh_token` or any substring of
 *   one. The reset URL is reduced to booleans *before* it reaches this module
 *   (`hasRecoveryCredential`), and only those booleans are accepted here.
 * - No session object. A session's presence is a boolean; its contents are never
 *   read, stored or printed.
 * - No environment value. Only the *names* of missing variables, which
 *   `lib/supabase/config.ts` already reports.
 *
 * Because the input is booleans and the output is a fixed vocabulary, this module
 * cannot leak by construction: there is no field through which a secret could
 * travel.
 */

import type { RecoveryFailureReason, RecoveryLinkShape } from "@/lib/auth/raya-password-recovery";

/** Boolean-only facts about one recovery attempt. Nothing here can be a secret. */
export interface RecoveryDiagnosticFacts {
  /** Which link shape the document was entered with, or `none`. */
  linkShape: RecoveryLinkShape;
  /** True when the entered URL carried a recovery credential at all. */
  sawCredential: boolean;
  /** True when a session existed by the time the gate was decided. */
  hasSession: boolean;
  /** True when the session was proven to come from a recovery link. */
  recoveryVerified: boolean;
  /** True when Supabase redirected back with an error instead of a credential. */
  linkError: boolean;
  /** True when the credential was present but rejected as unusable. */
  exchangeFailed: boolean;
  /** True when the public Supabase URL + anon key are present. */
  configOk: boolean;
}

/** A one-line, credential-free summary. Safe for the console and for a bug report. */
export function recoveryDiagnosticLine(facts: RecoveryDiagnosticFacts): string {
  return [
    "raya-ai/recovery",
    `reason=${recoveryDiagnosticReason(facts)}`,
    `link=${facts.linkShape}`,
    `credential=${facts.sawCredential ? "present" : "absent"}`,
    `session=${facts.hasSession ? "present" : "absent"}`,
    `verified=${facts.recoveryVerified ? "yes" : "no"}`,
    `config=${facts.configOk ? "ok" : "missing"}`,
  ].join(" ");
}

/** The single most useful category for a person reading a report. */
export function recoveryDiagnosticReason(facts: RecoveryDiagnosticFacts): RecoveryFailureReason | "ready" {
  if (!facts.configOk) return "link-error";
  if (facts.linkError) return "link-error";
  if (facts.exchangeFailed) return "expired-link";
  if (!facts.hasSession) return "no-session";
  if (!facts.recoveryVerified && !facts.sawCredential) return "not-recovery";
  return "ready";
}

/** A sentence a person can act on, keyed to the reason above. */
export function recoveryDiagnosticAdvice(facts: RecoveryDiagnosticFacts): string {
  switch (recoveryDiagnosticReason(facts)) {
    case "link-error":
      if (!facts.configOk) {
        return "This deployment is missing its Supabase configuration, so no reset link can be redeemed here.";
      }
      return "The link was rejected before a session could be created. Request a new link.";
    case "expired-link":
      return "The link was already used or has expired. Request a new link.";
    case "no-session":
      return facts.sawCredential
        ? "The link carried a credential but no session was created. Open the newest link in the same browser that requested it."
        : "No recovery credential was found. Open the link from the reset email in this browser.";
    case "not-recovery":
      return "A session exists, but this page was not opened from a reset link.";
    case "ready":
      return "";
  }
}
