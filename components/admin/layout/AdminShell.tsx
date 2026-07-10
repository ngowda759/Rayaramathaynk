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

  // Handle ESC key to close sidebar and body scroll locking
  useEffect(() => {
    let scrollY = 0;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSidebarOpen) {
        closeSidebar();
      }
    };

    if (isSidebarOpen) {
      document.addEventListener("keydown", handleEsc);
      // Save current scroll position before locking
      scrollY = window.scrollY;
      // Lock body scrolling when sidebar is open
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.touchAction = "none";
    } else {
      // Restore body scrolling
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      document.body.style.touchAction = "";
      // Restore scroll position
      window.scrollTo(0, scrollY);
    }

    return () => {
      document.removeEventListener("keydown", handleEsc);
      // Clean up styles
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      document.body.style.touchAction = "";
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
