"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  RECOVERY_REQUEST_ACKNOWLEDGEMENT,
  describeAuthFailure,
  toAuthErrorLike,
} from "@/lib/auth/raya-auth-errors";
import { RAYA_AI_AUTH_ROUTES } from "@/lib/auth/raya-auth-routes";
import { recoveryRedirectUrl } from "@/lib/auth/raya-password-recovery";
import { getSupabaseConfigStatus } from "@/lib/supabase/config";
import RayaAiAuthShell from "@/components/admin/ai/RayaAiAuthShell";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";

/**
 * Request a password-reset email for a Raya AI administrator (Supabase Auth).
 *
 * The acknowledgement is shown whatever the server answers. Reporting "no such
 * account" would let an anonymous caller test whether an address is an
 * administrator, so the response is deliberately indistinguishable.
 *
 * `redirectTo` must be an address the Supabase project lists under
 * Authentication > URL Configuration > Redirect URLs. If it is not, Supabase
 * silently sends the recovery link to the project's Site URL instead (the public
 * homepage), which is the "link lands on the homepage with no reset form" symptom
 * this page is paired with. See docs/RAYA_AI_PASSWORD_RECOVERY.md.
 */
export default function RayaAiForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const config = getSupabaseConfigStatus();
    if (!config.isConfigured) {
      setError(describeAuthFailure(null, "recovery-request", { notConfigured: true }).message);
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: recoveryRedirectUrl(
          window.location.origin,
          RAYA_AI_AUTH_ROUTES.resetPassword
        ),
      });
      // A rate limit is the one failure a person can act on; everything else is
      // reported as success so the endpoint cannot be used to probe for accounts.
      if (resetError && describeAuthFailure(resetError, "recovery-request").kind === "rate-limited") {
        setError(describeAuthFailure(resetError, "recovery-request").message);
        return;
      }
      setSent(true);
    } catch (thrown) {
      const failure = describeAuthFailure(toAuthErrorLike(thrown), "recovery-request");
      if (failure.kind === "network" || failure.kind === "unknown") {
        setError(failure.message);
        return;
      }
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RayaAiAuthShell
      title="Reset your Raya AI password"
      subtitle="We will email you a link to choose a new password."
    >
      {sent ? (
        <div className="mt-6 space-y-4">
          <p role="status" className="text-sm text-stone-700">
            {RECOVERY_REQUEST_ACKNOWLEDGEMENT}
          </p>
          <p className="text-sm text-stone-500">
            The link opens a page where you set a new password. If it lands on the
            temple homepage instead, ask an administrator to add this site&apos;s reset
            address to the Supabase redirect allow-list.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <Input
            label="Email"
            type="email"
            placeholder="Enter your email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {error && (
            <p role="alert" data-testid="raya-auth-error" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <Button type="submit" loading={submitting}>
            Send reset link
          </Button>

          <p className="text-center text-sm text-stone-500">
            Remembered it?{" "}
            <Link
              href={RAYA_AI_AUTH_ROUTES.login}
              className="font-medium text-orange-600 hover:underline"
            >
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </RayaAiAuthShell>
  );
}
