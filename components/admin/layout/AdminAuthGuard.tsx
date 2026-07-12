"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/context/AuthContext";
import { ShieldX } from "lucide-react";

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

const permissionLabels: Record<Permission, string> = {
  admin: "admin portal",
  settings: "settings",
  finance: "finance",
  users: "user management",
  billing: "billing",
  administration: "administration",
};

export default function AdminAuthGuard({ 
  children, 
  requiredPermission,
  fallback 
}: AdminAuthGuardProps) {
  const { user, loading } = useAuthContext();
  const router = useRouter();
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    // Only redirect once after auth is fully checked
    if (!loading && !user && !redirected) {
      const currentPath = window.location.pathname;
      setRedirected(true);
      router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [user, loading, redirected, router]);

  // Show loading while auth is initializing
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
      </div>
    );
  }

  // If not authenticated after loading, show redirecting message
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
          <p className="text-stone-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // User is authenticated, render children
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
