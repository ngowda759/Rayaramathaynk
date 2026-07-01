import { announcementService } from "@/services/announcement.service";
import { AnnouncementMarquee } from "./AnnouncementMarquee";

export default async function AnnouncementBar() {
  let announcements = [];
  let hasError = false;

  try {
    announcements = await announcementService.getActiveAnnouncements();
  } catch (error) {
    console.error("Failed to load announcements:", error);
    hasError = true;
  }

  return <AnnouncementMarquee announcements={announcements} hasError={hasError} />;
}
