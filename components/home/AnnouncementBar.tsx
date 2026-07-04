import { announcementService } from "@/services/announcement.service";
import { AnnouncementMarquee } from "./AnnouncementMarquee";

export default async function AnnouncementBar() {
  let announcements = [];
  let hasError = false;

  try {
    const data = await announcementService.getActiveAnnouncements();

    announcements = data.map((ann) => ({
      id: ann.id,
      title: ann.title,
      message: ann.message,
      link: ann.link ?? "",
      isActive: ann.isActive,
    }));
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
