import { announcementService } from "@/services/announcement.service";
import { AnnouncementMarquee } from "./AnnouncementMarquee";
import { Announcement } from "@/types/announcement";

// Force dynamic rendering to always get fresh data
export const dynamic = "force-dynamic";

export default async function AnnouncementBar() {
  let announcements: Announcement[] = [];
  let hasError = false;

  try {
    console.log("Fetching active announcements...");
    announcements = await announcementService.getActiveAnnouncements();
    console.log("Fetched announcements:", announcements.length);
  } catch (error: any) {
    console.error("Failed to load announcements:", error);
    // Check if it's an index error
    if (error?.message?.includes("requires an index") || error?.code === "failed-precondition") {
      console.error("Firestore index may be missing. Please create an index for isActive + createdAt.");
    }
    hasError = true;
  }

  return (
    <AnnouncementMarquee
      announcements={announcements}
      hasError={hasError}
    />
  );
}
