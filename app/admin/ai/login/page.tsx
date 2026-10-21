"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { safeReturnPath } from "@/lib/auth/safe-return";
import { describeAuthFailure, toAuthErrorLike } from "@/lib/auth/raya-auth-errors";
import { RAYA_AI_AUTH_ROUTES } from "@/lib/auth/raya-auth-routes";
import { getSupabaseConfigStatus } from "@/lib/supabase/config";
import RayaAiAuthShell from "@/components/admin/ai/RayaAiAuthShell";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";

/**
 * Sign-in for the Raya AI administration console.
 *
 * Uses Supabase Auth (email + password), which is independent of the temple's
 * Firebase login. After a successful sign-in the caller is returned to the AI
 * page they opened. Authorization (role + active) is enforced server-side on
 * every /api/ai request; this page only establishes the session.
 *
 * The failure message distinguishes a rejected credential from a transport or
 * configuration problem. Collapsing every failure into "Invalid email or
 * password." made a deployment without Supabase look like a forgotten password,
 * which is the misleading symptom this page used to produce.
 */
export default function RayaAiLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirect = safeReturnPath(searchParams.get("redirect"), "/admin/ai");

  useEffect(() => {
    // If a session already exists, skip the form.
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(redirect);
    });
  }, [router, redirect]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const config = getSupabaseConfigStatus();
    if (!config.isConfigured) {
      setError(describeAuthFailure(null, "sign-in", { notConfigured: true }).message);
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(describeAuthFailure(signInError, "sign-in").message);
        return;
      }
      router.replace(redirect);
    } catch (thrown) {
      setError(describeAuthFailure(toAuthErrorLike(thrown), "sign-in").message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RayaAiAuthShell
      title="Raya AI Administration"
      subtitle="Sign in with your administrator account."
      showBackToSignIn={false}
    >
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

        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-4 top-11 text-stone-500"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {error && (
          <p role="alert" data-testid="raya-auth-error" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <Button type="submit" loading={submitting}>
          Sign In
        </Button>

        <p className="text-center text-sm text-stone-500">
          <Link
            href={RAYA_AI_AUTH_ROUTES.forgotPassword}
            className="font-medium text-orange-600 hover:underline"
          >
            Forgot password?
          </Link>
        </p>
      </form>
    </RayaAiAuthShell>
  );
}
