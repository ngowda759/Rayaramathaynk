"use client";

import { useState } from "react";

import { GalleryAlbum, GalleryMedia } from "@/types/gallery";
import { galleryService } from "@/services/gallery.service";

import MediaCard from "./MediaCard";
import MediaDialog from "./MediaDialog";
import DeleteDialog from "./DeleteDialog";

interface Props {
  media: GalleryMedia[];
  albums: GalleryAlbum[];
  onRefresh: () => Promise<void>;
}

export default function MediaGrid({
  media,
  albums,
  onRefresh,
}: Props) {
  const [selected, setSelected] =
    useState<GalleryMedia | null>(null);

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [deleteOpen, setDeleteOpen] =
    useState(false);

  async function saveMedia(
    data: Omit<GalleryMedia, "id">
  ) {
    if (selected) {
      await galleryService.updateMedia(
        selected.id,
        data
      );
    } else {
      await galleryService.createMedia(
        data,
        "admin"
      );
    }

    await onRefresh();
  }

  async function deleteMedia() {
    if (!selected) return;

    await galleryService.deleteMedia(
      selected.id
    );

    await onRefresh();
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">

        <h2 className="text-2xl font-bold">
          Gallery Media
        </h2>

        <button
          onClick={() => {
            setSelected(null);
            setDialogOpen(true);
          }}
          className="rounded-xl bg-amber-600 px-5 py-2 font-medium text-white"
        >
          + Add Media
        </button>

      </div>

      {media.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center">
          No media found.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

          {media.map((item) => (
            <MediaCard
              key={item.id}
              media={item}
              albums={albums}
              onEdit={(m) => {
                setSelected(m);
                setDialogOpen(true);
              }}
              onDelete={(m) => {
                setSelected(m);
                setDeleteOpen(true);
              }}
            />
          ))}

        </div>
      )}

      <MediaDialog
        open={dialogOpen}
        media={selected}
        albums={albums}
        onClose={() => {
          setDialogOpen(false);
          setSelected(null);
        }}
        onSave={saveMedia}
      />

      <DeleteDialog
        open={deleteOpen}
        title="Delete Media"
        description="This action cannot be undone."
        onClose={() => {
          setDeleteOpen(false);
          setSelected(null);
        }}
        onDelete={deleteMedia}
      />

    </div>
  );
}
