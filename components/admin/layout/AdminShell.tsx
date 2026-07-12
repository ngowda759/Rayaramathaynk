"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
import AdminHeader from "./AdminHeader";
import AdminSidebar from "./AdminSidebar";

interface Props {
  children: ReactNode;
}

export default function AdminShell({ children }: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  // Handle ESC key to close sidebar
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSidebarOpen) {
        closeSidebar();
      }
    };

    if (isSidebarOpen) {
      document.addEventListener("keydown", handleEsc);
    }

    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isSidebarOpen, closeSidebar]);

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-stone-50">
      {/* Sidebar */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
      />

      {/* Main Content Area */}
      <div className="flex flex-col lg:pl-64">
        <AdminHeader onMenuClick={toggleSidebar} />
        <main className="flex-1 p-4 pb-20 lg:p-6 lg:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}
