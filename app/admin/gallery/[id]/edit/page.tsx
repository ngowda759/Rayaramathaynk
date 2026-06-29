"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import GalleryForm from "@/components/admin/gallery/GalleryForm";

import { galleryService } from "@/services/gallery.service";
import {
  GalleryImage,
  GalleryImageRequest,
} from "@/types/gallery";

export default function EditGalleryPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [image, setImage] = useState<GalleryImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadImage() {
      try {
        const data = await galleryService.getImageById(id);

        if (!data) {
          toast.error("Image not found.");
          router.push("/admin/gallery");
          return;
        }

        setImage(data);
      } catch (error) {
        console.error("Failed to load image:", error);
        toast.error("Failed to load image.");
        router.push("/admin/gallery");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadImage();
    }
  }, [id, router]);

  async function handleUpdate(
    data: GalleryImageRequest
  ) {
    try {
      setSaving(true);

      await galleryService.updateImage(id, data);

      toast.success("Image updated successfully.");

      router.push("/admin/gallery");
    } catch (error) {
      console.error("Failed to update image:", error);

      toast.error("Failed to update image.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <AdminPageHeader
          title="Edit Gallery Image"
          description="Loading..."
        />

        <div className="rounded-xl border bg-white p-8">
          Loading image...
        </div>
      </div>
    );
  }

  if (!image) {
    return null;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Edit Gallery Image"
        description="Update gallery image details."
      />

      <GalleryForm
        mode="edit"
        loading={saving}
        initialValues={image}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
