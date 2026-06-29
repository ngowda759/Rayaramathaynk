import { ReactNode } from "react";
import AdminShell from "@/components/admin/layout/AdminShell";

interface Props {
  children: ReactNode;
}

export default function AdminLayout({ children }: Props) {
  return <AdminShell>{children}</AdminShell>;
}
