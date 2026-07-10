"use client";

import { Bell, UserCircle } from "lucide-react";

export default function AdminHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">
          Sri Raghavendra Temple
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <Bell className="h-5 w-5 cursor-pointer" />

        <div className="flex items-center gap-2">
          <UserCircle className="h-8 w-8 text-orange-600" />

          <div>
            <p className="font-medium">Admin</p>
            <p className="text-xs text-gray-500">
              admin@rayaramatha.org
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
