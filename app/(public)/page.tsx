import HomeClient from "@/components/home/HomeClient";
import { getTempleGalleryImages } from "@/lib/gallery";

// Revalidate every 60 seconds to get fresh announcements
export const revalidate = 60;

export default function Home() {
  // Set next major event (You can make this dynamic from CMS)
  const nextMajorEvent = new Date();
  nextMajorEvent.setDate(nextMajorEvent.getDate() + 15); // Example: 15 days from now

  // Fetch gallery images on the server
  const gallery = getTempleGalleryImages();
  const lightboxImages = gallery.map((item) => ({
    src: item.image,
    alt: item.title,
    category: "festivals" as const,
  }));

  return <HomeClient nextMajorEvent={nextMajorEvent} galleryImages={lightboxImages} />;
}
