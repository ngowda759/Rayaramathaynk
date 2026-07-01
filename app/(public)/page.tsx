import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/home/Hero";
import TempleInfo from "@/components/home/TempleInfo";
import TempleMap from "@/components/home/TempleMap";
import FeaturedSevas from "@/components/home/FeaturedSevas";
import TempleTimings from "@/components/home/TempleTimings";
import AnnouncementBar from "@/components/home/AnnouncementBar";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import GalleryPreview from "@/components/home/GalleryPreview";
import DonationCTA from "@/components/home/DonationCTA";
import SocialConnect from "@/components/home/SocialConnect";
import Footer from "@/components/layout/Footer";
import Panchanga from "@/components/home/Panchanga";

export default function Home() {
  return (
    <>
      <Navbar />
      <AnnouncementBar />
      <Hero />
      <Panchanga />
      <TempleInfo />
      <TempleMap />
      <FeaturedSevas />
      <TempleTimings />
      <SocialConnect />
      <UpcomingEvents />
      <GalleryPreview />
      <DonationCTA />
      <Footer />
    </>
  );
}
