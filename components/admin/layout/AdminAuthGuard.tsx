"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/context/AuthContext";

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

export default function AdminAuthGuard({ 
  children, 
}: AdminAuthGuardProps) {
  const { user, loading } = useAuthContext();
  const router = useRouter();
  const initialized = useRef(false);

  useEffect(() => {
    // Give Firebase auth time to initialize on first load
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    
    // After initialization, if no user, redirect to login
    if (!loading && !user) {
      const currentPath = window.location.pathname;
      router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [user, loading, router]);

  // Show loading only on initial page load
  if (loading && !initialized.current) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
      </div>
    );
  }

  // Always render children - auth check happens in useEffect
  return <>{children}</>;
}

// Higher-order component for specific permission requirements
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredPermission: Permission
) {
  return function PermissionWrapper(props: P) {
    return (
      <AdminAuthGuard requiredPermission={requiredPermission}>
        <WrappedComponent {...props} />
      </AdminAuthGuard>
    );
  };
}
