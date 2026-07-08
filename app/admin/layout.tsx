import { ReactNode } from "react";
import AdminShell from "@/components/admin/layout/AdminShell";
import AdminChatbot from "@/components/chat/AdminChatbot";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";

interface Props {
  children: ReactNode;
}

export default function AdminLayout({ children }: Props) {
  return (
    <AdminAuthGuard>
      <AdminShell>
        {children}
        <AdminChatbot />
      </AdminShell>
    </AdminAuthGuard>
  );
}
