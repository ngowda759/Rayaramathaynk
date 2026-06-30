"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import SearchBox from "@/components/admin/common/SearchBox";
import CrudTable from "@/components/admin/crud/CrudTable";
import Button from "@/components/ui/button";

import { galleryService } from "@/services/gallery.service";
import { GalleryImage } from "@/types/gallery";
import { galleryColumns } from "./columns";

export default function GalleryPage() {
  const router = useRouter();

  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadImages() {
    try {
      setLoading(true);

      const data = await galleryService.getImages();

      setImages(data);
    } catch (error) {
      console.error("Failed to load gallery:", error);
      toast.error("Failed to load gallery.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadImages();
  }, []);

  const filteredImages = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) return images;

    return images.filter((image) =>
      [
        image.title,
        image.category,
        image.description,
      ].some((value) =>
        value.toLowerCase().includes(keyword)
      )
    );
  }, [images, search]);

  async function handleDelete(image: GalleryImage) {
    if (!window.confirm(`Delete "${image.title}"?`)) {
      return;
    }

    try {

      if (!image.id) return;

      await galleryService.deleteImage(image.id);

      toast.success("Image deleted successfully.");

      await loadImages();
    } catch (error) {
      console.error("Failed to delete image:", error);

      toast.error("Failed to delete image.");
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Gallery"
        description="Manage temple gallery."
        action={
          <Button asChild>
            <Link href="/admin/gallery/new">
              Add Image
            </Link>
          </Button>
        }
      />

      <SearchBox
        value={search}
        onChange={setSearch}
        placeholder="Search gallery..."
      />

      {loading ? (
        <div className="rounded-xl border bg-white p-8">
          Loading gallery...
        </div>
      ) : (
        <CrudTable<GalleryImage>
          data={filteredImages}
          columns={galleryColumns}
          emptyMessage="No images found."
          actions={{
            onEdit: (image) =>
              router.push(
                `/admin/gallery/${image.id}/edit`
              ),

            onDelete: handleDelete,
          }}
        />
      )}
    </div>
  );
}
