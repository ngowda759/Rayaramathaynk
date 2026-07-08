"use client";

import { ReactNode, useState } from "react";
import AdminHeader from "./AdminHeader";
import AdminSidebar from "./AdminSidebar";
import AdminErrorBoundary from "@/components/admin/common/AdminErrorBoundary";

interface Props {
  children: ReactNode;
}

export default function AdminShell({ children }: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Desktop: always visible at fixed position, Mobile: drawer */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
      />

      {/* Main Content - offset by sidebar width on desktop */}
      <div className="flex flex-1 flex-col lg:pl-72">
        <AdminHeader onMenuClick={toggleSidebar} />

        <main className="flex-1 p-4 md:p-6">
          <AdminErrorBoundary>{children}</AdminErrorBoundary>
        </main>
      </div>
    </div>
  );
}
