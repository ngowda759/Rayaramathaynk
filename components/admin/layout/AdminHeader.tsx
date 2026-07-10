"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Menu, Search, LogOut, Settings, Shield, ChevronDown } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import NotificationDropdown from "./NotificationDropdown";

interface AdminHeaderProps {
  onMenuClick: () => void;
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  volunteer: "Volunteer",
  devotee: "Devotee",
};

export default function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const { user, profile, normalizedRole, canAccessSettings, logout } = useAuthContext();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.toLowerCase().trim();
    if (!q) return;

    if (q.includes("event")) router.push("/admin/events");
    else if (q.includes("gallery") || q.includes("image") || q.includes("photo")) router.push("/admin/gallery");
    else if (q.includes("donation") || q.includes("donate")) router.push("/admin/donations");
    else if (q.includes("announc") || q.includes("notice")) router.push("/admin/announcements");
    else if (q.includes("user") || q.includes("staff")) router.push("/admin/users");
    else if (q.includes("seva")) router.push("/admin/sevas");
    else if (q.includes("pooja") || q.includes("timing")) router.push("/admin/timings");
    else if (q.includes("booking")) router.push("/admin/bookings");
    else if (q.includes("report")) router.push("/admin/reports");
    else if (q.includes("setting")) router.push("/admin/settings");
    else if (q.includes("aaradhane")) router.push("/admin/aaradhane");
    else router.push("/admin");

    setSearchQuery("");
  };

  const getInitials = () => {
    if (profile?.name) {
      return profile.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "A";
  };

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b bg-card/95 backdrop-blur-sm px-4 lg:px-6">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-orange-400 lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Page Title - Hidden on small screens */}
        <div className="hidden items-center gap-2 sm:flex">
          <h1 className="text-base font-semibold">
            Temple Administration
          </h1>
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 flex items-center gap-1">
            <Shield className="h-3 w-3" />
            {roleLabels[normalizedRole] || "Admin"}
          </span>
        </div>
      </div>

      {/* Center - Search */}
      <div className="hidden lg:block lg:w-full lg:max-w-md xl:max-w-lg">
        <form onSubmit={handleSearch} className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search... (⌘K)"
            className="h-9 w-full rounded-lg border bg-background pl-9 pr-12 text-sm outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden rounded border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground xl:inline-block">
            ⌘K
          </kbd>
        </form>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 md:gap-2">
        {/* Mobile Search */}
        <button
          className="rounded-lg p-2 hover:bg-accent lg:hidden"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </button>

        {/* Notifications */}
        <NotificationDropdown />

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-orange-400"
            aria-expanded={showUserMenu}
            aria-haspopup="true"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 font-semibold text-orange-700 text-sm">
              {getInitials()}
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </button>

          {showUserMenu && (
            <div
              className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border bg-white shadow-lg animate-in fade-in slide-in-from-top-2 duration-200"
              role="menu"
              aria-orientation="vertical"
            >
              {/* User Info */}
              <div className="border-b p-3">
                <p className="font-medium text-sm">{profile?.name || "Administrator"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  <Shield className="h-3 w-3" />
                  {roleLabels[normalizedRole] || "Admin"}
                </span>
              </div>

              {/* Menu Items */}
              <div className="p-1.5">
                {canAccessSettings && (
                  <Link
                    href="/admin/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-accent"
                    role="menuitem"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-red-600 hover:bg-red-50"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
