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
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isSidebarOpen, closeSidebar]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-50">
      {/* Sidebar - includes mobile overlay internally */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
      />

      {/* Main Content Area */}
      <div className="flex h-full flex-col lg:pl-64">
        <AdminHeader onMenuClick={toggleSidebar} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
