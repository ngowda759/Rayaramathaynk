"use client";

import { Bell } from "lucide-react";
import { Announcement } from "@/types/announcement";

interface AnnouncementMarqueeProps {
  announcements: Announcement[];
  hasError: boolean;
}

export function AnnouncementMarquee({
  announcements,
  hasError,
}: AnnouncementMarqueeProps) {
  const content = hasError || announcements.length === 0 ? (
    "Sri Raghavendra Aradhana Mahotsava • All devotees are welcome 🙏"
  ) : (
    announcements
      .map((ann) => {
        let text = `${ann.title}: ${ann.message}`;
        if (ann.link) {
          text += " • Learn more";
        }
        return text;
      })
      .join(" • ")
  );

  return (
    <div className="bg-maroon-700 bg-[#7A1024] text-white overflow-hidden">
      <style>{`
        @keyframes scroll {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        .announcement-scroll {
          animation: scroll 60s linear infinite;
          white-space: nowrap;
        }
        .announcement-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div className="mx-auto max-w-7xl px-6 py-3">
        <div className="flex items-center gap-3 text-sm font-medium">
          <Bell size={18} className="text-yellow-300 flex-shrink-0" />
          <div className="overflow-hidden flex-1">
            <div className="announcement-scroll">
              {content}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
