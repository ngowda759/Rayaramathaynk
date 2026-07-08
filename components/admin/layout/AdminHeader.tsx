"use client";

import { Bell, Menu, Search } from "lucide-react";

interface AdminHeaderProps {
  onMenuClick: () => void;
}

export default function AdminHeader({ onMenuClick }: AdminHeaderProps) {
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

          <p className="hidden text-xs text-muted-foreground sm:block">
            Manage temple operations efficiently
          </p>
        </div>
      </div>

      {/* Center */}
      <div className="hidden w-full max-w-md lg:flex">
        <div className="relative w-full">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

          <input
            placeholder="Search..."
            className="w-full rounded-xl border bg-background py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3 md:gap-4">
        <button className="relative rounded-xl p-2 hover:bg-muted">
          <Bell className="h-5 w-5" />

          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500"></span>
        </button>

        <div className="hidden text-right md:block">
          <p className="font-medium">Administrator</p>

          <p className="text-xs text-muted-foreground">
            Temple Portal
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 font-semibold text-orange-700">
          A
        </div>
      </div>
    </header>
  );
}
