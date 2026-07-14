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

interface GalleryImage {
  src: string;
  alt: string;
  category: string;
}

interface HomeClientProps {
  nextMajorEvent: Date;
  nextEventName?: string;
  galleryImages: GalleryImage[];
}

export default function HomeClient({ nextMajorEvent, nextEventName, galleryImages }: HomeClientProps) {
  return (
    <>
      <Navbar />
      <AnnouncementBar />
      <Hero />
      
      <SacredDivider variant="mandala" />
      
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
    </>
  );
}
