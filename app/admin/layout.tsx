import { ReactNode } from "react";
import AdminShell from "@/components/admin/layout/AdminShell";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

interface Props {
  children: ReactNode;
}

export default function AdminLayout({ children }: Props) {
  return (
    <ProtectedRoute>
      <AdminShell>{children}</AdminShell>
    </ProtectedRoute>
  );
}
