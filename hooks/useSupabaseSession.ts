"use client";

/**
 * Browser-side Supabase Auth session for the Raya AI administration pages.
 *
 * This is the client counterpart of `lib/auth/raya-admin-auth.ts`. It reports
 * *whether* a Supabase session exists so the UI can render the right screen; it
 * is never the security boundary. Every `/api/ai/**` route re-verifies the
 * session and the caller's role server-side.
 *
 * The browser client (`lib/supabase/client.ts`) persists the session in cookies
 * so the same session also reaches server route handlers.
 */

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export interface SupabaseSessionState {
  session: Session | null;
  /** True until the initial `getSession()` resolves. */
  loading: boolean;
}

export function useSupabaseSession(): SupabaseSessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
