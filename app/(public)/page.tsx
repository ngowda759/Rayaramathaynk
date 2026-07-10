import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/home/Hero";
import TempleMap from "@/components/home/TempleMap";
import FeaturedSevas from "@/components/home/FeaturedSevas";
import AnnouncementBar from "@/components/home/AnnouncementBar";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import GalleryPreview from "@/components/home/GalleryPreview";
import SocialBar from "@/components/home/SocialBar";
import Footer from "@/components/layout/Footer";
import CalendarCenter from "@/components/calendar/CalendarCenter";

// Revalidate every 60 seconds to get fresh announcements
export const revalidate = 60;

export default function Home() {
  return (
    <>
      <Navbar />
      <AnnouncementBar />
      <Hero />
      <TempleMap />
      <FeaturedSevas />
      <CalendarCenter />
      <UpcomingEvents />
      <GalleryPreview />
      <SocialBar />
      <Footer />
    </>
  );
}
