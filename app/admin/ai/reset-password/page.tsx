"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { describeAuthFailure, toAuthErrorLike } from "@/lib/auth/raya-auth-errors";
import { RAYA_AI_AUTH_ROUTES } from "@/lib/auth/raya-auth-routes";
import {
  RECOVERY_GATE_MESSAGES,
  evaluateRecoveryGate,
  readRecoveryIntent,
  validateNewPassword,
  type RecoveryGateState,
} from "@/lib/auth/raya-password-recovery";
import { getSupabaseConfigStatus } from "@/lib/supabase/config";
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
  // Set once the SDK reports a recovery session (the PASSWORD_RECOVERY event, or
  // a code/token this page redeemed itself).
  const recoveryVerified = useRef(false);
  // True when the page was opened from a recovery link at all.
  const arrivedViaLink = useRef(false);

  const resolveRecoverySession = useCallback(async () => {
    const supabase = createClient();
    const intent = readRecoveryIntent(window.location.href);
    arrivedViaLink.current = intent.shape !== "none" || intent.isRecovery;

    // Any failure - a rejected exchange, a thrown fetch, an unreadable URL -
    // means the link cannot be used, so the page says so rather than leaving a
    // spinner or an empty form.
    const failLink = () =>
      setGate(
        evaluateRecoveryGate({
          resolving: false,
          hasSession: false,
          recoveryVerified: false,
          linkError: true,
        })
      );

    try {
      // `getSession()` awaits client initialization, which is what redeems a
      // `?code=` or `#access_token=` link. Asking for the session first is what
      // prevents a second, doomed exchange of an already-used code.
      let session = (await supabase.auth.getSession()).data.session;

      if (intent.errorCode) {
        failLink();
        return;
      }

      if (!session && intent.shape === "pkce-code" && intent.code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(intent.code);
        if (exchangeError) {
          failLink();
          return;
        }
        recoveryVerified.current = true;
        session = (await supabase.auth.getSession()).data.session;
      }

      if (!session && intent.shape === "otp-token-hash" && intent.tokenHash) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: intent.tokenHash,
        });
        if (otpError) {
          failLink();
          return;
        }
        recoveryVerified.current = true;
        session = (await supabase.auth.getSession()).data.session;
      }

      if (session && intent.shape !== "none") {
        // The credential is single-use; drop it so a refresh cannot replay it.
        window.history.replaceState(window.history.state, "", window.location.pathname);
      }

      setGate(
        evaluateRecoveryGate({
          resolving: false,
          hasSession: Boolean(session),
          // A session obtained from a recovery link is proof enough: only the
          // browser that requested the reset holds the PKCE verifier.
          recoveryVerified: recoveryVerified.current || (arrivedViaLink.current && Boolean(session)),
          linkError: false,
        })
      );
    } catch {
      failLink();
    }
  }, []);

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
