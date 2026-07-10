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
  const content =
    hasError || announcements.length === 0
      ? "Sri Raghavendra Swamy Aradhana Mahotsava • All devotees are welcome 🙏"
      : announcements
          .map((ann) => {
            let text = `${ann.title}: ${ann.message}`;
            if (ann.link) text += " • Learn more";
            return text;
          })
          .join("   ✦   ");

  return (
    <div className="bg-[#7A1024] text-white border-y border-yellow-500/30">
      <style>{`
        @keyframes marquee {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(-100%);
          }
        }

        .marquee-wrapper {
          overflow: hidden;
          width: 100%;
        }

        .marquee-content {
          display: inline-block;
          white-space: nowrap;
          padding-left: 100%;
          animation: marquee 25s linear infinite;
        }

        .marquee-content:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3">
        <Bell className="h-5 w-5 flex-shrink-0 text-yellow-300" />

        <div className="marquee-wrapper">
          <div className="marquee-content text-sm font-medium">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}
