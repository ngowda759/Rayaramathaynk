import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/home/Hero";
import TempleTimings from "@/components/home/TempleTimings";
import QuickServices from "@/components/home/QuickServices";
import AnnouncementBar from "@/components/home/AnnouncementBar";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <AnnouncementBar />
      <Hero />
      <TempleTimings />
      <QuickServices />
    </>
  );
}
