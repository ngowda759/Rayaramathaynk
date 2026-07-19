import HomeClient from "@/components/home/HomeClient";
import { getTempleGalleryImages } from "@/lib/gallery";
import { getNextUpcomingEvent } from "@/lib/firebase";
import { dailySpiritualService } from "@/services/daily-spiritual.service";

// Revalidate every 60 seconds to get fresh announcements
export const revalidate = 60;

export default async function Home() {
  // Fetch the next upcoming event dynamically from Firestore
  const nextEvent = await getNextUpcomingEvent();
  
  // Fallback: if no events in DB, use a default date (15 days from now)
  const nextMajorEvent = nextEvent?.date ?? (() => {
    const date = new Date();
    date.setDate(date.getDate() + 15);
    return date;
  })();

  const nextEventName = nextEvent?.title ?? "Sri Raghavendra Jayanthi";

  // Fetch gallery images on the server
  const gallery = getTempleGalleryImages();
  const lightboxImages = gallery.map((item) => ({
    src: item.image,
    alt: item.title,
    category: "festivals" as const,
  }));

  // Fetch daily spiritual dashboard data server-side
  let dashboardData = null;
  try {
    dashboardData = await dailySpiritualService.getDashboardData();
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
  }

  return <HomeClient 
    nextMajorEvent={nextMajorEvent} 
    nextEventName={nextEventName}
    galleryImages={lightboxImages}
    dashboardData={dashboardData}
  />;
}
