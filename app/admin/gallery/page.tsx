"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import GalleryStats from "@/components/admin/gallery/GalleryStats";
import SearchBox from "@/components/admin/common/SearchBox";

export default function GalleryPage() {
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Temple Gallery"
        description="Manage temple gallery images."
      >
        <Link href="/admin/gallery/new">
          <Button>Add Image</Button>
        </Link>
      </AdminPageHeader>

      <GalleryStats
        total={0}
        featured={0}
        temple={0}
        festivals={0}
      />

      <SearchBox
        value={search}
        onChange={setSearch}
        placeholder="Search gallery..."
      />

      <div className="rounded-xl border bg-white p-12 text-center">
        <h2 className="text-xl font-semibold">No Images Found</h2>
        <p className="mt-2 text-stone-500">
          Start by adding your first gallery image.
        </p>
      </div>
    </div>
  );
}
