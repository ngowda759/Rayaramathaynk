"use client";

import { ReactNode } from "react";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";
import { RouteProgress } from "@/components/seva/motion/RouteProgress";
import { SevaMotion } from "@/components/seva/motion/SevaMotion";
import { SevaMeProvider } from "@/hooks/seva/useSevaMe";
import "@/styles/seva/tokens.css";

interface PrasadamLayoutProps {
  children: ReactNode;
}

/**
 * Prasadam counter (DB §11): prasadam volunteers, temple admins and super admins. The page itself checks its action
 * with SevaGate and the seva API checks every call; no amounts are shown here. SevaMotion and RouteProgress as in
 * the Receipt Book layout (plan A4P-1).
 */
export default function PrasadamLayout({ children }: PrasadamLayoutProps) {
  return (
    <AdminAuthGuard requiredPermission="sevaPrasadam">
      <SevaMeProvider>
        <SevaMotion>
          <div className="seva">
            <RouteProgress />
            {children}
          </div>
        </SevaMotion>
      </SevaMeProvider>
    </AdminAuthGuard>
  );
}
