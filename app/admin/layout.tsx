import { ReactNode, Suspense } from "react";
import AdminShell from "@/components/admin/layout/AdminShell";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";
import { GoUpButton } from "@/components/ui/GoUpButton";

interface Props {
  children: ReactNode;
}

function AdminLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-stone-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
        <p className="text-stone-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: Props) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminAuthGuard>
        <AdminShell>
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <GoUpButton />
        </AdminShell>
      </AdminAuthGuard>
    </Suspense>
  );
}
