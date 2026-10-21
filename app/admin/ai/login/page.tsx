"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { safeReturnPath } from "@/lib/auth/safe-return";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import Input from "@/components/ui/input";

/**
 * Sign-in for the Raya AI administration console.
 *
 * Uses Supabase Auth (email + password), which is independent of the temple's
 * Firebase login. After a successful sign-in the caller is returned to the AI
 * page they opened. Authorization (role + active) is enforced server-side on
 * every /api/ai request; this page only establishes the session.
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
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError("Invalid email or password.");
        return;
      }
      router.replace(redirect);
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-stone-50 p-4">
      <Card className="w-full max-w-md rounded-b-3xl shadow-xl shadow-amber-500/10">
        <div className="p-8">
          <h1 className="text-xl font-bold text-stone-800">Raya AI Administration</h1>
          <p className="text-sm text-stone-500 mt-1">
            Sign in with your administrator account.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
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
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            <Button type="submit" loading={submitting}>
              Sign In
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
