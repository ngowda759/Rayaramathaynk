"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import GalleryForm from "@/components/admin/gallery/GalleryForm";

import { useAuth } from "@/hooks/useAuth";
import { galleryService } from "@/services/gallery.service";
import { GalleryImageRequest } from "@/types/gallery";

export default function NewGalleryPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);

  async function handleCreate(data: GalleryImageRequest) {
    try {
      setLoading(true);

      await galleryService.createImage(
        data,
        user?.email ?? "admin"
      );

      toast.success("Image added successfully.");

      router.push("/admin/gallery");
    } catch (error) {
      console.error("Failed to create image:", error);

      toast.error("Failed to create image.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Add Gallery Image"
        description="Upload a new gallery image."
      />

      <GalleryForm
        mode="create"
        loading={loading}
        onSubmit={handleCreate}
      />
    </div>
  );
}
