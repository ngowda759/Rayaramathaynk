import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/home/Hero";
import TempleInfo from "@/components/home/TempleInfo";
import TempleTimings from "@/components/home/TempleTimings";
import QuickServices from "@/components/home/QuickServices";
import AnnouncementBar from "@/components/home/AnnouncementBar";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import GalleryPreview from "@/components/home/GalleryPreview";
import DonationCTA from "@/components/home/DonationCTA";
import Footer from "@/components/layout/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <AnnouncementBar />
      <Hero />
      <TempleInfo />
      <TempleTimings />
      <QuickServices />
      <UpcomingEvents />
      <GalleryPreview />
      <DonationCTA />
      <Footer />
    </>
  );
}
