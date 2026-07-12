"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
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
    <header className="sticky top-0 z-50 flex h-16 flex-shrink-0 items-center justify-between border-b border-amber-200/50 bg-white/90 backdrop-blur-xl px-4 lg:px-6 shadow-sm shadow-amber-500/5">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-xl p-2 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5 text-stone-700" />
        </button>

        {/* Logo and Title */}
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-white shadow-md border border-amber-200 group-hover:shadow-lg transition-shadow hidden sm:block">
            <Image
              src="/images/logos/ynk_matha_logo.png"
              alt="Temple Logo"
              fill
              className="object-cover"
            />
          </div>
          <div className="flex flex-col">
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
        <form onSubmit={handleSearch} className="relative w-full group">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 opacity-0 group-focus-within:opacity-10 transition-opacity" />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 group-focus-within:text-amber-600 transition-colors" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages... (⌘K)"
            className="relative h-10 w-full rounded-xl border border-amber-200 bg-white pl-11 pr-14 text-sm outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 focus:shadow-lg focus:shadow-amber-500/10"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-stone-500 xl:inline-flex items-center gap-1">
            <span className="text-[10px]">⌘</span>K
          </kbd>
        </form>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 md:gap-2">
        {/* Mobile Search */}
        <button
          className="rounded-xl p-2 hover:bg-amber-100 transition-colors lg:hidden"
          aria-label="Search"
        >
          <Search className="h-5 w-5 text-stone-600" />
        </button>

        {/* Notifications */}
        <NotificationDropdown />

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <motion.button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
            aria-expanded={showUserMenu}
            aria-haspopup="true"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 font-bold text-white text-sm shadow-lg shadow-amber-500/25">
                {getInitials()}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
            </div>
            <ChevronDown className="h-4 w-4 text-stone-500 hidden sm:block" />
          </motion.button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full z-[60] mt-2 w-72 overflow-hidden rounded-2xl border border-amber-200/50 bg-white shadow-xl shadow-amber-500/10"
                role="menu"
                aria-orientation="vertical"
              >
                {/* Decorative top */}
                <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
                
                {/* User Info */}
                <div className="border-b border-amber-100/50 bg-gradient-to-r from-amber-50/50 to-orange-50/30 p-5">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 font-bold text-white shadow-lg shadow-amber-500/25">
                        {getInitials()}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-green-500 ring-2 ring-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base text-stone-800 truncate">{profile?.name || "Administrator"}</p>
                      <p className="text-sm text-stone-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      <Shield className="h-3.5 w-3.5" />
                      {roleLabels[normalizedRole] || "Admin"}
                    </span>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="p-2">
                  {canAccessSettings && (
                    <Link
                      href="/admin/settings"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-stone-700 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 transition-colors"
                      role="menuitem"
                    >
                      <Settings className="h-4 w-4 text-amber-600" />
                      <span>Settings</span>
                    </Link>
                  )}
                  <Link
                    href="/"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-stone-700 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 transition-colors"
                    role="menuitem"
                  >
                    <span className="flex h-4 w-4 items-center justify-center text-amber-600">🏛️</span>
                    <span>View Website</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    role="menuitem"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
