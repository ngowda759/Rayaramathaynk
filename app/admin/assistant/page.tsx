"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import AdminAssistant from "@/components/admin/common/AdminAssistant";
import { eventService } from "@/services/event.service";
import { galleryService } from "@/services/gallery.service";
import { poojaService } from "@/services/pooja.service";

type Recommendation = {
  title: string;
  description: string;
  href: string;
  action: string;
};

export default function AdminAssistantPage() {
  const [loading, setLoading] = useState(true);
  const [totalEvents, setTotalEvents] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [featuredImages, setFeaturedImages] = useState(0);
  const [totalPoojas, setTotalPoojas] = useState(0);
  const [activePoojas, setActivePoojas] = useState(0);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [events, images, poojas] = await Promise.all([
          eventService.getEvents(),
          galleryService.getImages(),
          poojaService.getPoojas(),
        ]);

        setTotalEvents(events.length);
        setUpcomingEvents(
          events.filter((event) => event.status === "Upcoming").length
        );

        const featuredCount = images.filter((image) => image.isFeatured).length;

        setTotalImages(images.length);
        setFeaturedImages(featuredCount);

        setTotalPoojas(poojas.length);
        setActivePoojas(poojas.filter((pooja) => pooja.isActive).length);

        const recs = [];

        if (images.length > 0 && featuredCount / images.length < 0.15) {
          recs.push({
            title: "Feature more gallery images",
            description:
              "Less than 15% of gallery items are marked as featured. Select your best photos to highlight the temple.",
            href: "/admin/gallery",
            action: "Review Gallery",
          });
        }

        if (events.some((event) => event.status === "Upcoming" && !event.location)) {
          recs.push({
            title: "Complete upcoming event details",
            description:
              "Some upcoming events are missing location information. Update them to help visitors plan their attendance.",
            href: "/admin/events",
            action: "Review Events",
          });
        }

        if (poojas.some((pooja) => !pooja.notes)) {
          recs.push({
            title: "Add more pooja details",
            description:
              "Several pooja schedules do not include notes. Adding notes helps devotees understand the offerings.",
            href: "/admin/pooja",
            action: "Review Poojas",
          });
        }

        if (recs.length === 0) {
          recs.push({
            title: "All systems look healthy",
            description:
              "Your events, gallery, and pooja schedules are in good shape. Keep monitoring the portal regularly.",
            href: "/admin",
            action: "Go to Dashboard",
          });
        }

        setRecommendations(recs);
      } catch (error) {
        console.error("Failed to load assistant data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Admin Assistant"
        description="Get quick insights and recommended actions for temple management."
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border bg-white p-8 shadow-sm">
          <p className="text-stone-500">Loading assistant insights...</p>
        </div>
      ) : (
        <AdminAssistant
          totalEvents={totalEvents}
          upcomingEvents={upcomingEvents}
          totalImages={totalImages}
          featuredImages={featuredImages}
          totalPoojas={totalPoojas}
          activePoojas={activePoojas}
          recommendations={recommendations}
        />
      )}
    </div>
  );
}
