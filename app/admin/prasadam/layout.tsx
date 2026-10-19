"use client";

import { ReactNode } from "react";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";
import { SevaMeProvider } from "@/hooks/seva/useSevaMe";
import "@/styles/seva/tokens.css";

interface PrasadamLayoutProps {
  children: ReactNode;
}

/**
 * Prasadam counter (DB §11): prasadam volunteers, temple admins and super admins. The page itself checks its action
 * with SevaGate and the seva API checks every call; no amounts are shown here.
 */
export default function PrasadamLayout({ children }: PrasadamLayoutProps) {
  return (
    <AdminAuthGuard requiredPermission="sevaPrasadam">
      <SevaMeProvider>
        <div className="seva">{children}</div>
      </SevaMeProvider>
    </AdminAuthGuard>
  );
}
