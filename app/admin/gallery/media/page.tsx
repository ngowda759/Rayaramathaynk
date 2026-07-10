"use client";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import GalleryDashboard from "@/components/admin/gallery/GalleryDashboard";

export default function GalleryMediaPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Gallery Media"
        description="Manage gallery photos and videos."
      />

      <GalleryDashboard />
    </div>
  );
}
