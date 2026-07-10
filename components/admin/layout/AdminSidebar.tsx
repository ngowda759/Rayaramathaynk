"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuthContext } from "@/context/AuthContext";
import { navigation } from "./navigation";
import { icons } from "./icons";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const {
    canAccessSettings,
    canManageUsers,
    canAccessBilling,
    canAccessFinance,
    canAccessAdministration,
    normalizedRole,
  } = useAuthContext();

  const filteredNavigation = navigation.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (normalizedRole === "admin") {
        if (group.title === "Finance") return false;
        if (group.title === "Administration") return false;
        if (item.href.includes("/finance")) return false;
        if (item.href.includes("/billing")) return false;
        if (item.href.includes("/reports")) return false;
        if (item.href.includes("/donations")) return false;
        if (item.href.includes("/users")) return false;
        if (item.href.includes("/settings")) return false;
        if (item.href.includes("/assistant")) return false;
      }

      if (normalizedRole === "billing") {
        if (group.title === "Finance") return true;
        if (item.href === "/admin") return true;
        if (group.title === "Dashboard") return true;
        return false;
      }

      if (item.href.includes("/users") && !canManageUsers) {
        return false;
      }
      if (item.href.includes("/settings") && !canAccessSettings) {
        return false;
      }
      if (item.href.includes("/billing")) {
        return canAccessBilling;
      }
      if (group.title === "Administration" && !canAccessAdministration) {
        return false;
      }
      return true;
    }),
  })).filter((group) => group.items.length > 0);

  // Auto-expand groups with active items or Dashboard by default
  useEffect(() => {
    const newExpanded: Record<string, boolean> = {};
    filteredNavigation.forEach((group) => {
      const hasActiveItem = group.items.some((item) => {
        return pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
      });
      // Always expand Dashboard group
      newExpanded[group.title] = hasActiveItem || group.title === "Dashboard";
    });
    setExpandedGroups(newExpanded);
  }, [pathname, filteredNavigation]);

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab" && sidebarRef.current) {
        const focusable = sidebarRef.current.querySelectorAll<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    if (isOpen) {
      sidebarRef.current?.focus();
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const renderNavItem = (item: { href: string; title: string; icon: string }, closeMenu?: () => void) => {
    const Icon = icons[item.icon as keyof typeof icons];
    const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={closeMenu}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
          active
            ? "bg-orange-50 text-orange-600 font-semibold"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
        aria-current={active ? "page" : undefined}
      >
        {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
        <span>{item.title}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Desktop Sidebar - Fixed position */}
      <aside
        className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-64 lg:border-r lg:bg-card"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex-shrink-0 border-b px-4 py-4">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-white font-bold text-sm">
              🙏
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">Temple Portal</h1>
              <p className="text-xs text-muted-foreground">Administration</p>
            </div>
          </Link>
        </div>

        {/* Scrollable Navigation */}
        <nav
          className="flex-1 overflow-y-auto overscroll-contain py-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
          aria-label="Navigation"
        >
          {filteredNavigation.map((group) => (
            <div key={group.title} className="px-3 py-1">
              <button
                onClick={() => toggleGroup(group.title)}
                className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{group.title}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    expandedGroups[group.title] ? "rotate-180" : ""
                  )}
                />
              </button>
              <div
                className={cn(
                  "space-y-0.5 transition-all duration-200 pointer-events-auto",
                  expandedGroups[group.title] ? "mt-1" : "h-0 overflow-hidden pointer-events-none"
                )}
              >
                {group.items.map((item) => renderNavItem(item))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile Sidebar Drawer */}
      <aside
        ref={sidebarRef}
        tabIndex={-1}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-card shadow-xl transition-transform duration-300 ease-out lg:hidden",
          "focus:outline-none",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Mobile navigation"
        aria-hidden={!isOpen}
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile Header */}
        <div className="flex-shrink-0 flex items-center justify-between border-b px-4 py-3">
          <Link href="/admin" onClick={onClose} className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-white font-bold text-sm">
              🙏
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">Temple Portal</h1>
              <p className="text-xs text-muted-foreground">Administration</p>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-orange-400"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile Navigation - Scrollable */}
        <nav
          className="flex-1 overflow-y-auto overscroll-contain py-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
          aria-label="Mobile navigation links"
        >
          {filteredNavigation.map((group) => (
            <div key={group.title} className="px-3 py-1">
              <button
                onClick={() => toggleGroup(group.title)}
                className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{group.title}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    expandedGroups[group.title] ? "rotate-180" : ""
                  )}
                />
              </button>
              <div
                className={cn(
                  "space-y-0.5 overflow-hidden transition-all duration-200",
                  expandedGroups[group.title] ? "mt-1 max-h-96" : "max-h-0"
                )}
              >
                {group.items.map((item) => renderNavItem(item, onClose))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
