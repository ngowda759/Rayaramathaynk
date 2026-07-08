import { Suspense } from "react";
import AdminDashboardContent from "@/components/admin/dashboard/AdminDashboardContent";

function DashboardLoading() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <AdminDashboardContent />
    </Suspense>
  );
}
