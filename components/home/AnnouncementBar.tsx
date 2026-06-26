"use client";

import { Bell } from "lucide-react";

export default function AnnouncementBar() {
  return (
    <div className="bg-maroon-700 bg-[#7A1024] text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-6 py-3 text-sm font-medium">
        <Bell size={18} className="text-yellow-300" />

        <span>
          Sri Raghavendra Aradhana Mahotsava • August 14–16 • All devotees are
          welcome 🙏
        </span>
      </div>
    </div>
  );
}
