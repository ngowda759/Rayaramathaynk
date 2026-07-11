"use client";

import { ReactNode, useState, useEffect, useCallback, useRef } from "react";
import AdminHeader from "./AdminHeader";
import AdminSidebar from "./AdminSidebar";

interface Props {
  children: ReactNode;
}

export default function AdminShell({ children }: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const scrollPositionRef = useRef(0);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  // Handle ESC key to close sidebar and body scroll locking
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSidebarOpen) {
        closeSidebar();
      }
    };

    if (isSidebarOpen) {
      document.addEventListener("keydown", handleEsc);
      // Save current scroll position before locking
      scrollPositionRef.current = window.scrollY;
      // Lock body scrolling when sidebar is open
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.top = `-${scrollPositionRef.current}px`;
      // Hide scrollbar
      document.body.style.scrollbarWidth = "none";
    } else {
      // Restore body scrolling
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      document.body.style.scrollbarWidth = "";
      // Restore scroll position
      window.scrollTo(0, scrollPositionRef.current);
    }

    return () => {
      document.removeEventListener("keydown", handleEsc);
      // Clean up styles
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      document.body.style.scrollbarWidth = "";
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
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
