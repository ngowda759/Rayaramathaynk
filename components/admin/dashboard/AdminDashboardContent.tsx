"use client";

import { useSearchParams } from "next/navigation";
import DashboardContent from "./DashboardContent";
import AdminSearchResults from "./AdminSearchResults";

export default function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("search");

  if (query) {
    return <AdminSearchResults />;
  }

  return <DashboardContent />;
}
