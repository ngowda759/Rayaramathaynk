"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import GalleryTable from "@/components/admin/gallery/GalleryTable";
import GalleryStats from "@/components/admin/gallery/GalleryStats";
import SearchBox from "@/components/admin/common/SearchBox";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";

import { GalleryImage } from "@/types/gallery";
import { galleryService } from "@/services/gallery.service";

type GallerySummary = {
  total: number;
  featured: number;
  temple: number;
  festivals: number;
};

export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [stats, setStats] = useState<GallerySummary>({
    total: 0,
    featured: 0,
    temple: 0,
    festivals: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadImages() {
    try {
      const data = await galleryService.getImages();
      setImages(data);
      setStats({
        total: data.length,
        featured: data.filter((image) => image.isFeatured).length,
        temple: data.filter(
          (image) => image.category === "Temple Infrastructure"
        ).length,
        festivals: data.filter((image) => image.category === "Utsava").length,
      });
    } catch (error) {
      console.error("Failed to load images:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadImages();
  }, []);

  const filteredImages = images.filter((image) => {
    const keyword = search.toLowerCase();
    return (
      image.title.toLowerCase().includes(keyword) ||
      image.description.toLowerCase().includes(keyword) ||
      image.category.toLowerCase().includes(keyword) ||
      image.tags.some((tag) => tag.toLowerCase().includes(keyword))
    );
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Gallery Management"
        description="Manage temple gallery images, categories, and featured photos."
        action={
          <Button asChild>
            <Link href="/admin/gallery/create">Add Image</Link>
          </Button>
        }
      />

      <GalleryStats
        total={stats.total}
        featured={stats.featured}
        temple={stats.temple}
        festivals={stats.festivals}
      />

      <div className="flex items-center justify-between gap-4">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search by title, category, or tag..."
        />
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">Loading gallery...</p>
        </div>
      ) : (
        <GalleryTable images={filteredImages} onRefresh={loadImages} />
      )}
    </div>
  );
}
