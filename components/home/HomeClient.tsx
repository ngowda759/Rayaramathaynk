"use client";

import SacredDivider from "@/components/home/SacredDivider";
import Testimonials from "@/components/home/Testimonials";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import GallerySection from "@/components/home/GallerySection";
import SocialBar from "@/components/home/SocialBar";
import Footer from "@/components/layout/Footer";
import TempleMap from "@/components/home/TempleMap";
import Panchanga from "@/components/home/Panchanga";
import CalendarCenter from "@/components/calendar/CalendarCenter";
import AnnouncementBar from "@/components/home/AnnouncementBar";
import Hero from "@/components/home/Hero";
import Navbar from "@/components/layout/Navbar";
import { PageTransition } from "@/components/ui/PageTransition";
import DailySpiritualDashboard from "@/components/home/DailySpiritualDashboard";
import type { DailySpiritualDashboard as DashboardType } from "@/types/daily-spiritual";

interface GalleryImage {
  src: string;
  alt: string;
  category: string;
}

interface HomeClientProps {
  nextMajorEvent: Date;
  nextEventName?: string;
  galleryImages: GalleryImage[];
  dashboardData?: DashboardType | null | undefined;
}

export default function HomeClient({ 
  nextMajorEvent, 
  nextEventName, 
  galleryImages,
  dashboardData,
}: HomeClientProps) {
  return (
    <PageTransition>
      <Navbar />
      <AnnouncementBar />
      <Hero />
      
      <SacredDivider variant="mandala" />
      
      {/* Daily Spiritual Dashboard - NEW Epic 1 */}
      <DailySpiritualDashboard initialData={dashboardData} />
      
      <SacredDivider variant="lotus" />
      
      {/* Legacy Panchanga Section - kept for detailed view */}
      <Panchanga />
      
      <SacredDivider variant="lotus" />
      
      <TempleMap />
      
      <SacredDivider variant="om" />
      
      <CalendarCenter 
        nextMajorEvent={nextMajorEvent}
        nextEventName={nextEventName}
      />
      
      <SacredDivider variant="mandala" />
      
      <UpcomingEvents />
      
      <SacredDivider variant="lotus" />
      
      <GallerySection images={galleryImages} />
      
      <SacredDivider variant="om" />
      
      <Testimonials />
      
      <SacredDivider variant="diya" />
      
      <SocialBar />
      
      <Footer />
    </PageTransition>
  );
}
