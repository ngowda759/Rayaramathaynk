"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, getEntryLocationHref } from "@/lib/supabase/client";
import { describeAuthFailure, toAuthErrorLike } from "@/lib/auth/raya-auth-errors";
import { RAYA_AI_AUTH_ROUTES } from "@/lib/auth/raya-auth-routes";
import {
  RECOVERY_GATE_MESSAGES,
  evaluateRecoveryGate,
  hasRecoveryCredential,
  readRecoveryIntent,
  validateNewPassword,
  type RecoveryGateState,
} from "@/lib/auth/raya-password-recovery";
import { getSupabaseConfigStatus } from "@/lib/supabase/config";
import {
  recoveryDiagnosticAdvice,
  recoveryDiagnosticLine,
  type RecoveryDiagnosticFacts,
} from "@/lib/auth/raya-recovery-diagnostics";
import RayaAiAuthShell from "@/components/admin/ai/RayaAiAuthShell";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";

/**
 * Choose a new password after following a Supabase recovery link.
 *
 * A recovery link arrives in one of three shapes (see
 * `lib/auth/raya-password-recovery.ts`), and this page must redeem whichever it
 * is without consuming the credential twice:
 *
 * - `?code=` (PKCE) is redeemed by the browser client itself while it
 *   initializes, because `detectSessionInUrl` defaults to true. The explicit
 *   `exchangeCodeForSession` here is therefore only a *fallback* for the case
 *   where initialization did not consume the code.
 * - `?token_hash=&type=recovery` is verified with `verifyOtp`.
 * - A `#access_token=...&type=recovery` fragment is also redeemed during
 *   initialization, and announces itself with a `PASSWORD_RECOVERY` event.
 *
 * The form is shown only for a session that came from a recovery link. The new
 * password is written with `updateUser({ password })` - the only supported
 * Supabase-native path. No Firebase call is involved.
 */
export default function RayaAiResetPasswordPage() {
  const router = useRouter();
  const [gate, setGate] = useState<RecoveryGateState>({ state: "resolving" });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Boolean-only facts about this attempt, for the redacted diagnostic line.
  const [facts, setFacts] = useState<RecoveryDiagnosticFacts | null>(null);
  // Set once the SDK reports a recovery session (the PASSWORD_RECOVERY event, or
  // a code/token this page redeemed itself).
  const recoveryVerified = useRef(false);

  const resolveRecoverySession = useCallback(async () => {
    const supabase = createClient();
    // The address the document was *entered* with, not the live one: the SDK
    // redeems a PKCE `?code=` (or a `#access_token=` fragment) during its own
    // initialization and erases it from the address bar. By the time this effect
    // runs - after AdminAuthGuard has already created the client and awaited it -
    // `window.location` no longer carries the credential, so reading it here was
    // why a valid link was reported as "open this page from the reset link".
    const entryUrl = getEntryLocationHref() ?? window.location.href;
    const entryIntent = readRecoveryIntent(entryUrl);
    // A `?token_hash=` link is the one shape the SDK does not consume, so the live
    // URL can still hold it; consider both so no supported format is missed.
    const liveIntent = readRecoveryIntent(window.location.href);
    const intent = entryIntent.shape !== "none" ? entryIntent : liveIntent;
    const sawRecoveryCredential =
      hasRecoveryCredential(entryUrl) || hasRecoveryCredential(window.location.href);
    let exchangeFailed = false;

    try {
      // `getSession()` awaits client initialization, which is what redeems a
      // `?code=` or `#access_token=` link. Asking for the session first is what
      // prevents a second, doomed exchange of an already-used code.
      let session = (await supabase.auth.getSession()).data.session;

      if (intent.errorCode) {
        exchangeFailed = true;
      } else if (!session && intent.shape === "pkce-code" && intent.code) {
        // Only reached when initialization did not consume the code, so this is
        // not a double redemption.
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(intent.code);
        if (exchangeError) {
          exchangeFailed = true;
        } else {
          recoveryVerified.current = true;
          session = (await supabase.auth.getSession()).data.session;
        }
      } else if (!session && intent.shape === "otp-token-hash" && intent.tokenHash) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: intent.tokenHash,
        });
        if (otpError) {
          exchangeFailed = true;
        } else {
          recoveryVerified.current = true;
          session = (await supabase.auth.getSession()).data.session;
        }
      }

      if (session && intent.shape !== "none") {
        // The credential is single-use; drop it so a refresh cannot replay it.
        window.history.replaceState(window.history.state, "", window.location.pathname);
      }

      setGate(
        evaluateRecoveryGate({
          resolving: false,
          hasSession: Boolean(session),
          recoveryVerified: recoveryVerified.current,
          sawRecoveryCredential,
          linkError: false,
          exchangeFailed,
        })
      );
      setFacts({
        linkShape: intent.shape,
        sawCredential: sawRecoveryCredential,
        hasSession: Boolean(session),
        recoveryVerified: recoveryVerified.current,
        linkError: false,
        exchangeFailed,
        configOk: getSupabaseConfigStatus().isConfigured,
      });
    } catch {
      setGate(
        evaluateRecoveryGate({
          resolving: false,
          hasSession: false,
          recoveryVerified: false,
          sawRecoveryCredential,
          linkError: true,
          exchangeFailed: false,
        })
      );
      setFacts({
        linkShape: intent.shape,
        sawCredential: sawRecoveryCredential,
        hasSession: false,
        recoveryVerified: false,
        linkError: true,
        exchangeFailed: false,
        configOk: getSupabaseConfigStatus().isConfigured,
      });
    }
  }, []);

  // One redacted line per attempt, so a support report can name the category.
  // The line is built from booleans only - no code, token, hash or session ever
  // reaches it (see lib/auth/raya-recovery-diagnostics.ts).
  useEffect(() => {
    if (!facts) return;
    console.info(recoveryDiagnosticLine(facts));
  }, [facts]);

  useEffect(() => {
    const supabase = createClient();
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "PASSWORD_RECOVERY") return;
      recoveryVerified.current = true;
      setGate((current) => (current.state === "resolving" ? current : { state: "ready" }));
    });

    // The callback handles its own failures, so the effect only starts it.
    void resolveRecoverySession();

    return () => subscription.subscription.unsubscribe();
  }, [resolveRecoverySession]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const validation = validateNewPassword(password, confirmation);
    if (!validation.ok) {
      setError(validation.error ?? "Please check the new password.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(describeAuthFailure(updateError, "password-update").message);
        return;
      }
      setDone(true);
      // A recovery session is an ordinary session; end it so the person signs in
      // with the password they just chose.
      await supabase.auth.signOut();
      setTimeout(() => router.replace(RAYA_AI_AUTH_ROUTES.login), 1500);
    } catch (thrown) {
      setError(describeAuthFailure(toAuthErrorLike(thrown), "password-update").message);
    } finally {
      setSubmitting(false);
    }
  }

  const config = getSupabaseConfigStatus();

  return (
    <RayaAiAuthShell
      title="Choose a new password"
      subtitle="Set a new password for your Raya AI administrator account."
    >
      {done ? (
        <p role="status" className="mt-6 text-sm text-stone-700">
          Your password has been updated. Redirecting you to sign in&hellip;
        </p>
      ) : gate.state === "resolving" ? (
        <p className="mt-6 text-sm text-stone-500" role="status">
          Checking your reset link&hellip;
        </p>
      ) : gate.state === "ready" ? (
        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <Input
            label="New password"
            type="password"
            placeholder="Enter a new password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            label="Confirm new password"
            type="password"
            placeholder="Re-enter the new password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            required
          />

          {error && (
            <p role="alert" data-testid="raya-auth-error" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <Button type="submit" loading={submitting}>
            Update password
          </Button>
        </form>
      ) : (
        <div className="mt-6 space-y-4">
          <p role="alert" data-testid="raya-auth-error" className="text-sm text-red-600">
            {gate.message}
          </p>
          {facts && (
            <p className="text-sm text-stone-600" data-testid="raya-recovery-advice">
              {recoveryDiagnosticAdvice(facts)}
            </p>
          )}
          {!config.isConfigured && (
            <p className="text-sm text-stone-500">
              This deployment is missing its Supabase configuration, so no reset link
              can be redeemed here.
            </p>
          )}
          <Link
            href={RAYA_AI_AUTH_ROUTES.forgotPassword}
            className="inline-block text-sm font-medium text-orange-600 hover:underline"
          >
            Request a new reset link
          </Link>
          {gate.state === "no-session" && (
            <p className="text-xs text-stone-400">{RECOVERY_GATE_MESSAGES.noSession}</p>
          )}
        </div>
      )}
    </RayaAiAuthShell>
  );
}
