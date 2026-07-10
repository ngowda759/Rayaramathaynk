"use client";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import AdminPageWrapper from "@/components/admin/common/AdminPageWrapper";
import GalleryDashboard from "@/components/admin/gallery/GalleryDashboard";

export default function AdminGalleryPage() {
  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        <AdminPageHeader
          title="Gallery Management"
          description="Manage albums, photos and videos."
        />

        <GalleryDashboard />
      </div>
    </AdminPageWrapper>
  );
}
