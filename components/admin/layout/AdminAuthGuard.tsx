"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/context/AuthContext";
import { ShieldX, Lock } from "lucide-react";

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
  const { user, loading, canAccessAdmin, canAccessSettings, canAccessFinance, canManageUsers, canAccessBilling, canAccessAdministration } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Check permission if required
  const hasPermission = (() => {
    if (!requiredPermission) return true;
    switch (requiredPermission) {
      case "admin":
        return canAccessAdmin;
      case "settings":
        return canAccessSettings;
      case "finance":
        return canAccessFinance;
      case "users":
        return canManageUsers;
      case "billing":
        return canAccessBilling;
      case "administration":
        return canAccessAdministration;
      default:
        return false;
    }
  })();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (requiredPermission && !hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <ShieldX className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-stone-900">
          Access Denied
        </h2>
        <p className="mb-6 max-w-md text-stone-600">
          You don&apos;t have permission to access the {permissionLabels[requiredPermission]} section. 
          Please contact an administrator if you believe this is an error.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/admin")}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => router.push("/login")}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Sign In with Different Account
          </button>
        </div>
      </div>
    );
  }

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
