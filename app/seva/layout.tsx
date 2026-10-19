"use client";

import { ReactNode, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";
import { PrintRoot } from "@/components/seva/slip/PrintRoot";
import { RouteProgress } from "@/components/seva/motion/RouteProgress";
import { SevaMotion } from "@/components/seva/motion/SevaMotion";
import { SevaMeProvider } from "@/hooks/seva/useSevaMe";
import "@/styles/seva/tokens.css";
import "@/styles/seva/print.css";

interface SevaLayoutProps {
  children: ReactNode;
}

/** Shown while the guard reads the address (useSearchParams); the same look as the website admin's loading screen. */
function SevaLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-stone-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
        <p className="text-stone-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}

/**
 * Seva Entry at `/seva` (plan A4S-1). The outer guard is the one the module had under the website admin, so existing
 * admin-console users keep their access; each seva page checks its own action with SevaGate, and the seva API checks
 * every call. The Suspense boundary is needed because AdminAuthGuard reads useSearchParams. The `.seva` wrapper scopes
 * the module look (styles/seva/tokens.css); PrintRoot is where receipt slips are printed from. SevaMotion gives every
 * seva screen the module spring; RouteProgress is the top bar shown while a seva link is loading (plan A4P-1).
 * The frames come from the two route groups (plan A4S-2): `(desk)` draws the header, section rail and phone bar,
 * `(counter)` the full-screen counter; each holds the page's `main#main-content`, the skip link's target.
 */
export default function SevaLayout({ children }: SevaLayoutProps) {
  return (
    <Suspense fallback={<SevaLoading />}>
      <GuardedSeva>{children}</GuardedSeva>
    </Suspense>
  );
}

/**
 * Inside the Suspense boundary, because it reads the address. A signed-out visitor is sent to sign in and comes back
 * to the page they opened, with its query (plan A4S-2), not to the website admin.
 */
function GuardedSeva({ children }: SevaLayoutProps) {
  const pathname = usePathname() ?? "";
  const search = useSearchParams()?.toString() ?? "";
  const returnTo = search ? `${pathname}?${search}` : pathname;
  return (
    <AdminAuthGuard requiredPermission="billing" returnTo={returnTo}>
      <SevaMeProvider>
        <SevaMotion>
          <div className="seva">
            <RouteProgress />
            {children}
          </div>
        </SevaMotion>
        <PrintRoot />
      </SevaMeProvider>
    </AdminAuthGuard>
  );
}
