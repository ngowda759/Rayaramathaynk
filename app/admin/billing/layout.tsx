"use client";

import { ReactNode } from "react";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";

interface BillingLayoutProps {
  children: ReactNode;
}

export default function BillingLayout({ children }: BillingLayoutProps) {
  return (
    <AdminAuthGuard requiredPermission="billing">
      {children}
    </AdminAuthGuard>
  );
}
