import { announcementService } from "@/services/announcement.service";
import { AnnouncementMarquee } from "./AnnouncementMarquee";
import { Announcement } from "@/types/announcement";

export default async function AnnouncementBar() {
  let announcements: Announcement[] = [];
  let hasError = false;

  try {
    announcements = await announcementService.getActiveAnnouncements();
  } catch (error) {
    console.error("Failed to load announcements:", error);
    hasError = true;
  }

  return (
    <AnnouncementMarquee
      announcements={announcements}
      hasError={hasError}
    />
  );
}
