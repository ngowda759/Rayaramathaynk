"use client";

import { Bell, LogOut, UserCircle } from "lucide-react";

export default function AdminHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div>
        <h2 className="text-2xl font-bold text-stone-800">
          Admin Dashboard
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <button className="rounded-full p-2 hover:bg-stone-100">
          <Bell className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <UserCircle className="h-8 w-8 text-orange-600" />

          <div className="text-right">
            <p className="text-sm font-semibold">
              Temple Admin
            </p>

            <p className="text-xs text-stone-500">
              admin@rayaramatha.org
            </p>
          </div>
        </div>

        <button className="rounded-full p-2 hover:bg-red-100 hover:text-red-600">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
