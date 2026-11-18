"use client";

import { useEffect, useState } from "react";
import { announcementService } from "@/services/announcement.service";
import { AnnouncementMarquee } from "./AnnouncementMarquee";
import { Announcement } from "@/types/announcement";

export default function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    async function fetchAnnouncements() {
      try {
        console.log("Fetching active announcements...");
        const data = await announcementService.getActiveAnnouncements();
        setAnnouncements(data);
        console.log("Fetched announcements:", data.length);
      } catch (error: any) {
        console.error("Failed to load announcements:", error);
        setHasError(true);
      }
    }
    fetchAnnouncements();
  }, []);

  return (
    <AnnouncementMarquee
      announcements={announcements}
      hasError={hasError}
    />
  );
}
