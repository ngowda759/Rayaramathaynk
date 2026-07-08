import { ReactNode } from "react";
import AdminShell from "@/components/admin/layout/AdminShell";
import AdminChatbot from "@/components/chat/AdminChatbot";

interface Props {
  children: ReactNode;
}

export default function AdminLayout({ children }: Props) {
  return (
    <AdminShell>
      {children}
      <AdminChatbot />
    </AdminShell>
  );
}
