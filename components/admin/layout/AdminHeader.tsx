"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Menu, Search, LogOut, User, Settings, Shield } from "lucide-react";
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.toLowerCase().trim();
    if (!q) return;
    
    // Navigate directly to matching pages
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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 md:px-6 backdrop-blur">
      {/* Left */}
      <div className="flex items-center gap-3 md:gap-4">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-orange-400 lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <h1 className="text-lg md:text-xl font-semibold">
            Temple Administration
          </h1>

          <div className="flex items-center gap-2">
            <p className="hidden text-xs text-muted-foreground sm:block">
              Manage temple operations
            </p>
            <span className="hidden items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 sm:flex">
              <Shield className="h-3 w-3" />
              {roleLabels[normalizedRole] || "Admin"}
            </span>
          </div>
        </div>
      </div>

      {/* Center - Search */}
      <div className="hidden w-full max-w-md lg:block">
        <form onSubmit={handleSearch} className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages, events, users..."
            className="w-full rounded-xl border bg-background py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-400"
          />
        </form>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Notifications */}
        <NotificationDropdown />

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-xl p-2 hover:bg-muted"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 font-semibold text-orange-700">
              {getInitials()}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium">
                {profile?.name || user?.email?.split("@")[0] || "Administrator"}
              </p>
              <p className="text-xs text-muted-foreground">
                {roleLabels[normalizedRole] || "Admin"}
              </p>
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-white shadow-lg">
              <div className="border-b p-4">
                <p className="font-medium">{profile?.name || "Administrator"}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <Shield className="h-3 w-3" />
                  {roleLabels[normalizedRole] || "Admin"}
                </span>
              </div>
              <div className="p-2">
                {canAccessSettings && (
                  <Link
                    href="/admin/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 rounded-lg p-2 text-sm hover:bg-muted"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-sm text-red-600 hover:bg-red-50"
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
