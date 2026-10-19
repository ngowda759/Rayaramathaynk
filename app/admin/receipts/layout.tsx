"use client";

import { ReactNode } from "react";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";
import { PrintRoot } from "@/components/seva/slip/PrintRoot";
import { SevaMeProvider } from "@/hooks/seva/useSevaMe";
import "@/styles/seva/tokens.css";
import "@/styles/seva/print.css";

interface ReceiptsLayoutProps {
  children: ReactNode;
}

/**
 * Receipt Book (Seva Entry). The outer guard is unchanged, so existing admin-console users keep their access; each
 * seva page checks its own action with SevaGate, and the seva API checks every call. The `.seva` wrapper scopes the
 * module look (styles/seva/tokens.css); PrintRoot is where receipt slips are printed from.
 */
export default function ReceiptsLayout({ children }: ReceiptsLayoutProps) {
  return (
    <AdminAuthGuard requiredPermission="billing">
      <SevaMeProvider>
        <div className="seva">{children}</div>
        <PrintRoot />
      </SevaMeProvider>
    </AdminAuthGuard>
  );
}
