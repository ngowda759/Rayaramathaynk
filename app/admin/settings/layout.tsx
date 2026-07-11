"use client";

import { ReactNode } from "react";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";

interface SettingsLayoutProps {
  children: ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <AdminAuthGuard requiredPermission="settings">
      {children}
    </AdminAuthGuard>
  );
}
