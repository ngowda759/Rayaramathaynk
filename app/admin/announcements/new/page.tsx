"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import AnnouncementForm from "@/components/admin/announcements/AnnouncementForm";

import { announcementService } from "@/services/announcement.service";
import { AnnouncementRequest } from "@/types/announcement";

export default function NewAnnouncementPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  async function handleCreate(
    data: AnnouncementRequest
  ) {
    try {
      setLoading(true);

      await announcementService.addAnnouncement(data);

      toast.success(
        "Announcement created successfully."
      );

      router.push("/admin/announcements");
    } catch (error) {
      console.error(
        "Failed to create announcement:",
        error
      );

      toast.error(
        "Failed to create announcement."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Create Announcement"
        description="Create a new announcement."
      />

      <AnnouncementForm
        mode="create"
        loading={loading}
        onSubmit={handleCreate}
      />
    </div>
  );
}
