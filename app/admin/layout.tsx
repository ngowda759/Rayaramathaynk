import { ReactNode } from "react";
import AdminShell from "@/components/admin/layout/AdminShell";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";
import { GoUpButton } from "@/components/ui/GoUpButton";

interface Props {
  children: ReactNode;
}

export default function AdminLayout({ children }: Props) {
  return (
    <AdminAuthGuard>
      <AdminShell>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <GoUpButton />
      </AdminShell>
    </AdminAuthGuard>
  );
}
