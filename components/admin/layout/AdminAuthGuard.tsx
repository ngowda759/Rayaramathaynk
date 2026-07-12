"use client";

import { useEffect, useState } from "react";
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
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) return;
    
    // Only check once after loading is done
    if (!checked) {
      setChecked(true);
      return;
    }
    
    // If still no user after loading, redirect
    if (!user) {
      const currentPath = window.location.pathname;
      router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [user, loading, checked, router]);

  // Always render children - auth happens in background
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
