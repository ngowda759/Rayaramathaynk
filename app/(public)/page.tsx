import type { Metadata } from "next";

import HomeClient from "@/components/home/HomeClient";
import { getTempleGalleryImages } from "@/lib/gallery";
import { dailySpiritualService } from "@/services/daily-spiritual.server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Sri Raghavendra Swamy Matha, Yelahanka New Town",
  description:
    "Official website of Sri Raghavendra Swamy Matha, Yelahanka New Town, Bengaluru. Daily pooja timings, seva bookings, festivals, gallery and donations.",
  path: "/",
  absolute: true,
});

// Revalidate every 60 seconds to get fresh announcements
export const revalidate = 60;

export default async function Home() {
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
    galleryImages={lightboxImages}
    dashboardData={dashboardData}
  />;
}
