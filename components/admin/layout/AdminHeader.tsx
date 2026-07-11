"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
    <header className="sticky top-0 z-50 flex h-16 flex-shrink-0 items-center justify-between border-b bg-gradient-to-r from-amber-50 to-orange-50 px-4 lg:px-6 shadow-sm">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400 lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5 text-stone-700" />
        </button>

        {/* Logo and Title */}
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-full bg-white shadow-sm border border-amber-200">
            <Image
              src="/images/logos/ynk_matha_logo.png"
              alt="Temple Logo"
              fill
              className="object-cover"
            />
          </div>
          <div className="hidden sm:flex flex-col">
            <h1 className="text-base font-bold text-stone-800">
              Temple Admin
            </h1>
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {roleLabels[normalizedRole] || "Admin"}
            </span>
          </div>
        </div>
      </div>

      {/* Center - Search */}
      <div className="hidden lg:block lg:w-full lg:max-w-md xl:max-w-lg">
        <form onSubmit={handleSearch} className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search... (⌘K)"
            className="h-9 w-full rounded-lg border border-amber-200 bg-white pl-9 pr-12 text-sm outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs text-stone-500 xl:inline-block">
            ⌘K
          </kbd>
        </form>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 md:gap-2">
        {/* Mobile Search */}
        <button
          className="rounded-lg p-2 hover:bg-amber-100 lg:hidden"
          aria-label="Search"
        >
          <Search className="h-5 w-5 text-stone-600" />
        </button>

        {/* Notifications */}
        <NotificationDropdown />

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
            aria-expanded={showUserMenu}
            aria-haspopup="true"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500 font-semibold text-white text-sm shadow-sm">
              {getInitials()}
            </div>
            <ChevronDown className="h-4 w-4 text-stone-500 hidden sm:block" />
          </button>

          {showUserMenu && (
            <div
              className="absolute right-0 top-full z-[60] mt-2 w-64 rounded-xl border border-amber-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
              role="menu"
              aria-orientation="vertical"
            >
              {/* User Info */}
              <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500 font-semibold text-white shadow-sm">
                    {getInitials()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-stone-800">{profile?.name || "Administrator"}</p>
                    <p className="text-xs text-stone-500 truncate">{user?.email}</p>
                  </div>
                </div>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
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
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-stone-700 hover:bg-amber-50"
                    role="menuitem"
                  >
                    <Settings className="h-4 w-4 text-amber-600" />
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
