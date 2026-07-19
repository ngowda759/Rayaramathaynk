"use client";

import SacredDivider from "@/components/home/SacredDivider";
import Testimonials from "@/components/home/Testimonials";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import GallerySection from "@/components/home/GallerySection";
import SocialBar from "@/components/home/SocialBar";
import Footer from "@/components/layout/Footer";
import TempleMap from "@/components/home/TempleMap";
import Panchanga from "@/components/home/Panchanga";
import AnnouncementBar from "@/components/home/AnnouncementBar";
import Hero from "@/components/home/Hero";
import Navbar from "@/components/layout/Navbar";
import { PageTransition } from "@/components/ui/PageTransition";
import DailySpiritualDashboard from "@/components/home/DailySpiritualDashboard";
import RecommendationsSection from "@/components/recommendation/RecommendationsSection";
import type { DailySpiritualDashboard as DashboardType } from "@/types/daily-spiritual";

interface GalleryImage {
  src: string;
  alt: string;
  category: string;
}

interface HomeClientProps {
  galleryImages: GalleryImage[];
  dashboardData?: DashboardType | null | undefined;
}

export default function HomeClient({
  galleryImages,
  dashboardData,
}: HomeClientProps) {
  return (
    <PageTransition>
      <Navbar />
      <AnnouncementBar />
      <Hero />

      <SacredDivider variant="mandala" />

      {/* Daily Spiritual Dashboard - Epic 1 */}
      <DailySpiritualDashboard initialData={dashboardData} />

      <SacredDivider variant="lotus" />

      {/* Daily Panchanga Section */}
      <Panchanga />

      <SacredDivider variant="lotus" />

      <TempleMap />

      <SacredDivider variant="mandala" />

      <UpcomingEvents />

      <SacredDivider variant="lotus" />

      {/* Smart Recommendations - Epic 7 */}
      <section className="bg-gradient-to-b from-white to-amber-50">
        <div className="mx-auto max-w-7xl px-6">
          <RecommendationsSection
            title="Explore More"
            subtitle="Discover spiritual content tailored for you"
            variant="grid"
            maxItems={6}
            showRefresh={true}
          />
        </div>
      </section>

      <SacredDivider variant="mandala" />

      <GallerySection images={galleryImages} />

      <SacredDivider variant="om" />

      <Testimonials />

      <SacredDivider variant="diya" />

      <SocialBar />

      <Footer />
    </PageTransition>
  );
}
