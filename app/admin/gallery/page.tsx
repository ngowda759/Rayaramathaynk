"use client";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import GalleryDashboard from "@/components/admin/gallery/GalleryDashboard";

export default function AdminGalleryPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Gallery Management"
        description="Manage albums, photos and videos."
      />

      <GalleryDashboard />
    </div>
  );
}
