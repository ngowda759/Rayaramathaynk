"use client";

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

// TEMPORARILY DISABLED - Auth guard is disabled for testing
export default function AdminAuthGuard({ 
  children, 
}: AdminAuthGuardProps) {
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
