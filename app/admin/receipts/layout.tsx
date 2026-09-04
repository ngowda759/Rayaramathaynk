"use client";

import { ReactNode } from "react";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";

interface ReceiptsLayoutProps {
  children: ReactNode;
}

export default function ReceiptsLayout({ children }: ReceiptsLayoutProps) {
  return (
    <AdminAuthGuard requiredPermission="billing">
      {children}
    </AdminAuthGuard>
  );
}