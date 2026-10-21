"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import Card from "@/components/ui/card";
import { RAYA_AI_AUTH_ROUTES } from "@/lib/auth/raya-auth-routes";
import { getSupabaseConfigStatus, supabaseConfigMessage } from "@/lib/supabase/config";

/**
 * The shared frame for the three Raya AI authentication screens (sign-in,
 * recovery request, reset). They share one look so the console feels like one
 * product, and one place decides what to show when the deployment is missing its
 * Supabase configuration - in that state none of the three can work, so the
 * warning is rendered here rather than repeated in each page.
 */
export default function RayaAiAuthShell({
  title,
  subtitle,
  children,
  showBackToSignIn = true,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  showBackToSignIn?: boolean;
}) {
  const config = getSupabaseConfigStatus();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-stone-50 p-4">
      <Card className="w-full max-w-md rounded-b-3xl shadow-xl shadow-amber-500/10">
        <div className="p-8">
          <h1 className="text-xl font-bold text-stone-800">{title}</h1>
          <p className="text-sm text-stone-500 mt-1">{subtitle}</p>

          {!config.isConfigured && (
            <div
              role="alert"
              className="mt-5 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
            >
              <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{supabaseConfigMessage(config)}</span>
            </div>
          )}

          {children}

          {showBackToSignIn && (
            <p className="mt-6 text-center text-sm text-stone-500">
              <Link
                href={RAYA_AI_AUTH_ROUTES.login}
                className="font-medium text-orange-600 hover:underline"
              >
                Back to sign in
              </Link>
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
