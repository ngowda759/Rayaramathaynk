"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getFirebaseConfigStatus } from "@/lib/firebase";

type Permission = 
  | "admin" 
  | "settings" 
  | "finance" 
  | "users" 
  | "billing" 
  | "administration";

interface AdminAuthGuardProps {
  children: React.ReactNode;
  requiredPermission?: Permission;
  fallback?: React.ReactNode;
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
}: AdminAuthGuardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, canAccessAdmin } = useAuth();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Use setTimeout to avoid synchronous state update during effect
    const timer = setTimeout(() => {
      setIsClient(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Show loading while checking auth
  if (loading || !isClient) {
    return <LoadingSpinner />;
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
    const redirect = searchParams.get("redirect") || "/admin";
    router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
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
    }
    
    if (!hasPermission) {
      return <AccessDenied />;
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
