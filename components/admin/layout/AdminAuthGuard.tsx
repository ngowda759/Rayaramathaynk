"use client";

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

// Auth protection is handled by middleware.ts
// This component is a placeholder for future permission checks
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
