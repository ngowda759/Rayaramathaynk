"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DashboardContent from "./DashboardContent";
import AdminSearchResults from "./AdminSearchResults";

function LoadingSpinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
    </div>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("search");

  if (query) {
    return <AdminSearchResults />;
  }

  return <DashboardContent />;
}

export default function AdminDashboardContent() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SearchContent />
    </Suspense>
  );
}
