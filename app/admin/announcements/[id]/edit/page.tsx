"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import AnnouncementForm from "@/components/admin/announcements/AnnouncementForm";

import { announcementService } from "@/services/announcement.service";
import {
  Announcement,
  AnnouncementRequest,
} from "@/types/announcement";

export default function EditAnnouncementPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [announcement, setAnnouncement] =
    useState<Announcement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadAnnouncement() {
      try {
        const data =
          await announcementService.getAnnouncement(id);

        if (!data) {
          toast.error("Announcement not found.");
          router.push("/admin/announcements");
          return;
        }

        setAnnouncement(data);
      } catch (error) {
        console.error(
          "Failed to load announcement:",
          error
        );

        toast.error(
          "Failed to load announcement."
        );

        router.push("/admin/announcements");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadAnnouncement();
    }
  }, [id, router]);

  async function handleUpdate(
    data: AnnouncementRequest
  ) {
    try {
      setSaving(true);

      await announcementService.updateAnnouncement(
        id,
        data
      );

      toast.success(
        "Announcement updated successfully."
      );

      router.push("/admin/announcements");
    } catch (error) {
      console.error(
        "Failed to update announcement:",
        error
      );

      toast.error(
        "Failed to update announcement."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <AdminPageHeader
          title="Edit Announcement"
          description="Loading..."
        />

        <div className="rounded-xl border bg-white p-8">
          Loading announcement...
        </div>
      </div>
    );
  }

  if (!announcement) {
    return null;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Edit Announcement"
        description="Update announcement."
      />

      <AnnouncementForm
        mode="edit"
        loading={saving}
        initialValues={announcement}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
