"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { announcementService } from "@/services/announcement.service";
import { Announcement } from "@/types/announcement";

export default function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnnouncements() {
      setLoading(true);

      try {
        const activeAnnouncements = await announcementService.getActiveAnnouncements();
        setAnnouncements(activeAnnouncements);
      } catch (error) {
        console.error("Failed to load announcements:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAnnouncements();
  }, []);

  const content = loading ? (
    <span>Loading announcements...</span>
  ) : announcements.length === 0 ? (
    <span>
      Sri Raghavendra Aradhana Mahotsava • August 14–16 • All devotees are welcome 🙏
    </span>
  ) : (
    <div className="flex flex-wrap items-center gap-4">
      {announcements.map((announcement) => (
        <div key={announcement.id} className="flex items-center gap-2">
          <span className="font-semibold">{announcement.title}:</span>
          <span>{announcement.message}</span>
          {announcement.link ? (
            <a
              href={announcement.link}
              target="_blank"
              rel="noreferrer"
              className="underline text-yellow-200 hover:text-yellow-100"
            >
              Learn more
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );

  return (
    <div className="bg-maroon-700 bg-[#7A1024] text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3 px-6 py-3 text-sm font-medium">
        <Bell size={18} className="text-yellow-300" />
        {content}
      </div>
    </div>
  );
}
