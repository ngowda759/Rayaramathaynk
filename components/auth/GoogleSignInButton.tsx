"use client";

/**
 * "Continue with Google" — presentation only.
 *
 * It holds no authorization or provisioning logic: the flow is started by lib/auth/oauth.ts and the
 * identity is decided by app/auth/callback/route.ts on the server. The button renders nothing unless
 * `NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN` is `"true"`, so a deployment with the provider disabled (or not
 * configured) never shows a sign-in path that cannot work.
 */

import { useState } from "react";

import { isGoogleSignInEnabled, signInWithGoogle } from "@/lib/auth/oauth";

interface GoogleSignInButtonProps {
  /** Where to land after a successful sign-in. Sanitized by the OAuth helper; never used as-is. */
  next?: string | null;
  /** Read once at render, so tests can pin either state without touching the environment. */
  enabled?: boolean;
  className?: string;
}

export default function GoogleSignInButton({ next = null, enabled, className }: GoogleSignInButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEnabled = enabled ?? isGoogleSignInEnabled();
  if (!isEnabled) return null;

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const outcome = await signInWithGoogle(next);
      if (!outcome.ok) {
        setError(outcome.message);
        setPending(false);
      }
      // On success the browser is navigating to the provider; leaving the button pending avoids a
      // second click starting a second flow.
    } catch {
      setError("Google sign-in could not be started. Please try again or use your email and password.");
      setPending(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending}
        className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-stone-300 bg-white px-4 py-3 font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
          <path
            fill="#4285F4"
            d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.86c2.26-2.08 3.56-5.15 3.56-8.87Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24Z"
          />
          <path
            fill="#FBBC05"
            d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.28a12 12 0 0 0 0 10.76l3.99-3.09Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
          />
        </svg>
        <span>{pending ? "Connecting to Google…" : "Continue with Google"}</span>
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
