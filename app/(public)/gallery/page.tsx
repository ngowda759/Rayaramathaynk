"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import GalleryGrid from "@/components/home/FullGallery";
import { list } from "@vercel/blob";

type GalleryItem = {
  id: string;
  type: "image" | "video";
  src: string;
  alt: string;
  title: string;
  year?: string;
};

// This component runs on client to properly fetch blob videos
export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGalleryItems() {
      try {
        // Fetch blob videos from Vercel
        const { blobs } = await list({ prefix: "gallery/videos/" });
        const blobVideos: GalleryItem[] = blobs.map((video, index) => {
          const filename = video.pathname.split("/").pop() || `video-${index + 1}`;
          const label = filename
            .replace(/\.[^.]+$/, "") // Remove extension
            .replace(/[-_]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          const yearMatch = label.match(/\b(19|20)\d{2}\b/);
          const year = yearMatch ? yearMatch[0] : undefined;

          return {
            id: `video-blob-${video.pathname}`,
            type: "video" as const,
            src: video.url,
            alt: label || "Temple video",
            title: label || `Temple video ${index + 1}`,
            year,
          };
        });

        // Static images from public folder - we need to use a different approach
        // For now, we'll just show blob videos
        setItems([...blobVideos]);
      } catch (error) {
        console.error("[Gallery] Error fetching items:", error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    fetchGalleryItems();
  }, []);

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white px-6 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <Breadcrumb current="Gallery" />
        </div>
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="rounded-3xl border border-stone-200 bg-stone-50 p-12 text-center text-stone-700 shadow-sm">
              <p className="text-lg">No videos found yet.</p>
              <p className="mt-2 text-sm">Upload videos via the Admin Dashboard.</p>
            </div>
          </div>
        ) : (
          <GalleryGrid items={items} />
        )}
      </main>
      <Footer />
    </>
  );
}
