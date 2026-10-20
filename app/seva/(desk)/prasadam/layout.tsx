"use client";

import { ReactNode } from "react";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";

interface PrasadamLayoutProps {
  children: ReactNode;
}

/**
 * Prasadam counter (DB §11): prasadam volunteers, temple admins and super admins. The page itself checks its action
 * with SevaGate and the seva API checks every call; no amounts are shown here. The seva providers, motion and progress
 * bar come from app/seva/layout.tsx (plan A4S-1); repeating them here would draw a second progress bar.
 */
export default function PrasadamLayout({ children }: PrasadamLayoutProps) {
  return <AdminAuthGuard requiredPermission="sevaPrasadam">{children}</AdminAuthGuard>;
}
