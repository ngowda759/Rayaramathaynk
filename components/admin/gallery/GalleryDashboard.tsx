"use client";

import { useEffect, useState } from "react";

import { galleryService } from "@/services/gallery.service";

import GalleryStats from "./GalleryStats";
import GalleryToolbar from "./GalleryToolbar";
import AlbumGrid from "./AlbumGrid";
import MediaGrid from "./MediaGrid";
import AlbumDialog from "./AlbumDialog";
import DeleteDialog from "./DeleteDialog";

import {
  GalleryAlbum,
  GalleryMedia,
} from "@/types/gallery";

export default function GalleryDashboard() {
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [media, setMedia] = useState<GalleryMedia[]>([]);
  const [loading, setLoading] = useState(true);

  const [albumDialogOpen, setAlbumDialogOpen] =
    useState(false);

  const [selectedAlbum, setSelectedAlbum] =
    useState<GalleryAlbum | null>(null);

  const [deleteOpen, setDeleteOpen] =
    useState(false);

  async function load() {
    setLoading(true);

    const [albumData, mediaData] =
      await Promise.all([
        galleryService.getAlbums(),
        galleryService.getMedia(),
      ]);

    setAlbums(albumData);
    setMedia(mediaData);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveAlbum(
    data: Omit<GalleryAlbum, "id">
  ) {
    if (selectedAlbum) {
      await galleryService.updateAlbum(
        selectedAlbum.id,
        data
      );
    } else {
      await galleryService.createAlbum(data);
    }

    setSelectedAlbum(null);

    await load();
  }

  async function deleteAlbum() {
    if (!selectedAlbum) return;

    await galleryService.deleteAlbum(
      selectedAlbum.id
    );

    setSelectedAlbum(null);

    await load();
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center">
        Loading Gallery...
      </div>
    );
  }

  return (
    <div className="space-y-8">

      <GalleryStats
        albums={albums}
        media={media}
      />

      <GalleryToolbar
        onRefresh={load}
        onNewAlbum={() => {
          setSelectedAlbum(null);
          setAlbumDialogOpen(true);
        }}
      />

      <AlbumGrid
        albums={albums}
        onEdit={(album) => {
          setSelectedAlbum(album);
          setAlbumDialogOpen(true);
        }}
        onDelete={(album) => {
          setSelectedAlbum(album);
          setDeleteOpen(true);
        }}
      />

      <MediaGrid
        albums={albums}
        media={media}
        onRefresh={load}
      />

      <AlbumDialog
        open={albumDialogOpen}
        album={selectedAlbum}
        onClose={() => {
          setAlbumDialogOpen(false);
          setSelectedAlbum(null);
        }}
        onSave={saveAlbum}
      />

      <DeleteDialog
        open={deleteOpen}
        title="Delete Album"
        description="This action cannot be undone."
        onClose={() => {
          setDeleteOpen(false);
          setSelectedAlbum(null);
        }}
        onDelete={deleteAlbum}
      />

    </div>
  );
}
