"use client";

import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onRefresh: () => void;
  onNewAlbum: () => void;
}

export default function GalleryToolbar({
  onRefresh,
  onNewAlbum,
}: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-white p-6 md:flex-row md:items-center md:justify-between">

      <div>
        <h2 className="text-xl font-bold">
          Gallery Manager
        </h2>

        <p className="text-sm text-stone-500">
          Manage albums, photos and videos.
        </p>
      </div>

      <div className="flex gap-3">

        <Button
          variant="outline"
          onClick={onRefresh}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>

        <Button onClick={onNewAlbum}>
          <Plus className="mr-2 h-4 w-4" />
          New Album
        </Button>

        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Media
        </Button>

      </div>

    </div>
  );
}
