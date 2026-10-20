"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { getFirebaseConfigStatus } from "@/lib/firebase";
import { safeReturnPath } from "@/lib/auth/safe-return";
import { signInPath } from "@/lib/seva/routes";
import type { SevaRole } from "@/types/seva";

type Permission =
  | "admin"
  | "settings"
  | "finance"
  | "users"
  | "billing"
  | "administration"
  // Seva Entry areas (DB §3.3): real role checks on the seva role from AuthContext (C-62 allow-list).
  | "sevaCounter"
  | "sevaPrasadam"
  | "sevaAdmin";

/** Who may open each seva area. View-only and per-action limits are checked by SevaGate and the seva API. */
const SEVA_AREA_ROLES: Record<"sevaCounter" | "sevaPrasadam" | "sevaAdmin", readonly SevaRole[]> = {
  sevaCounter: ["receptionist", "temple_admin", "super_admin"],
  sevaPrasadam: ["prasadam_counter", "temple_admin", "super_admin"],
  sevaAdmin: ["temple_admin", "super_admin"],
};

interface AdminAuthGuardProps {
  children: React.ReactNode;
  requiredPermission?: Permission;
  fallback?: React.ReactNode;
  /**
   * The page (path and query) to come back to after signing in. Seva Entry passes the page that was opened; without
   * it a signed-out visitor goes to sign-in returning to the address's `redirect` or `/admin`, as before.
   */
  returnTo?: string;
}

// Simple loading spinner component
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-stone-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
        <p className="text-stone-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}

// Access denied component
function AccessDenied() {
  const router = useRouter();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-stone-50">
      <div className="text-center p-8 max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-6V4a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-3" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-stone-800 mb-2">Access Denied</h1>
        <p className="text-stone-600 mb-6">You don&apos;t have permission to access this area.</p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}

export default function AdminAuthGuard({ 
  children, 
  requiredPermission,
  returnTo,
}: AdminAuthGuardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user, loading, canAccessAdmin, sevaRole } = useAuth();
  // Raya AI pages authenticate with Supabase Auth, not Firebase. A Supabase
  // session on /admin/ai/* must satisfy this guard so the Raya AI console is
  // reachable without a Firebase sign-in. Every other /admin/** path is
  // unchanged: it still requires the Firebase session and role.
  const { session: supabaseSession, loading: supabaseLoading } = useSupabaseSession();
  // The Raya AI sign-in page itself is not gated (otherwise it would loop).
  const isRayaAiLogin = pathname === "/admin/ai/login";
  const isRayaAiPath =
    !isRayaAiLogin &&
    (pathname === "/admin/ai" || pathname.startsWith("/admin/ai/"));
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Use setTimeout to avoid synchronous state update during effect
    const timer = setTimeout(() => {
       
      setIsClient(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Show loading while checking auth. On Raya AI paths the Supabase session must
  // also settle before deciding, otherwise a signed-in admin would be bounced.
  if (loading || !isClient || (isRayaAiPath && supabaseLoading)) {
    return <LoadingSpinner />;
  }

  // The Raya AI sign-in page renders inside this layout but must not be gated by
  // either auth provider; it is the entry point that establishes the session.
  if (isRayaAiLogin) {
    return <>{children}</>;
  }

  // Raya AI administration is satisfied by a Supabase session. The server-side
  // role/active check happens on every /api/ai request; this is only routing.
  if (isRayaAiPath) {
    if (!supabaseSession) {
      const redirect = safeReturnPath(searchParams.get("redirect"), pathname);
      router.replace(`/admin/ai/login?redirect=${encodeURIComponent(redirect)}`);
      return <LoadingSpinner />;
    }
    return <>{children}</>;
  }

  // Check if Firebase is configured
  const firebaseStatus = getFirebaseConfigStatus();
  
  // If Firebase is not configured, show a helpful message
  if (!firebaseStatus.isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-stone-50">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-stone-800 mb-2">Firebase Not Configured</h1>
          <p className="text-stone-600 mb-4">
            Please configure Firebase in your environment variables to use this application.
          </p>
          <p className="text-sm text-stone-500 mb-6">
            Missing: {firebaseStatus.missingFields.join(", ")}
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Check if user is logged in
  if (!user) {
    // Redirect to login with the return URL
    if (returnTo) {
      router.replace(signInPath(returnTo));
    } else {
      // Only a path on this site is relayed to the sign-in page (A4S security gate, H-1).
      const redirect = safeReturnPath(searchParams.get("redirect"), "/admin");
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
    }
    return <LoadingSpinner />;
  }

  // Check if user can access admin (only super_admin, temple_admin, priest, staff, billing)
  if (!canAccessAdmin) {
    // Redirect non-admin users to home page
    router.replace("/");
    return <LoadingSpinner />;
  }

  // Check permission if required
  if (requiredPermission) {
    let hasPermission = false;
    switch (requiredPermission) {
      case "admin":
        hasPermission = canAccessAdmin;
        break;
      case "settings":
      case "finance":
      case "users":
      case "billing":
      case "administration":
        hasPermission = canAccessAdmin;
        break;
      case "sevaCounter":
      case "sevaPrasadam":
      case "sevaAdmin":
        hasPermission = typeof sevaRole === "string" && SEVA_AREA_ROLES[requiredPermission].includes(sevaRole);
        break;
    }
    
    if (!hasPermission) {
      // Redirect non-admin users to home page instead of showing access denied
      router.replace("/");
      return <LoadingSpinner />;
    }
  }

  // User is authenticated and authorized
  return <>{children}</>;
}

// Higher-order component for specific permission requirements
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredPermission: Permission
) {
  return function PermissionWrapper(props: P) {
    return <WrappedComponent {...props} />;
  };
}
