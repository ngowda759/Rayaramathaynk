"use client";

import { useEffect, useState } from "react";
import { announcementService } from "@/services/announcement.service";
import { AnnouncementMarquee } from "./AnnouncementMarquee";
import { Announcement } from "@/types/announcement";

export default function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnnouncements() {
      try {
        console.log("Fetching active announcements...");
        const data = await announcementService.getActiveAnnouncements();
        setAnnouncements(data);
        console.log("Fetched announcements:", data.length);
      } catch (error: any) {
        console.error("Failed to load announcements:", error);
        if (error?.message?.includes("requires an index") || error?.code === "failed-precondition") {
          console.error("Firestore index may be missing.");
        }
        setHasError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchAnnouncements();
  }, []);

  if (loading) {
    return null;
  }

  return (
    <AnnouncementMarquee
      announcements={announcements}
      hasError={hasError}
    />
  );
}
