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
  const [error, setError] = useState<string | null>(null);

  const [albumDialogOpen, setAlbumDialogOpen] =
    useState(false);

  const [selectedAlbum, setSelectedAlbum] =
    useState<GalleryAlbum | null>(null);

  const [deleteOpen, setDeleteOpen] =
    useState(false);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [albumData, mediaData] =
        await Promise.all([
          galleryService.getAlbums(),
          galleryService.getMedia(),
        ]);

      setAlbums(albumData);
      setMedia(mediaData);
    } catch (err: any) {
      console.error("Failed to load gallery:", err);
      // More detailed error message
      const errorMessage = err?.message || err?.code || "Unknown error";
      console.log("Error details:", errorMessage);
      setError(`Failed to load gallery: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveAlbum(
    data: Omit<GalleryAlbum, "id">
  ) {
    try {
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
    } catch (err) {
      console.error("Failed to save album:", err);
      alert("Failed to save album. Please try again.");
    }
  }

  async function deleteAlbum() {
    if (!selectedAlbum) return;

    try {
      await galleryService.deleteAlbum(
        selectedAlbum.id
      );

      setSelectedAlbum(null);
      await load();
    } catch (err) {
      console.error("Failed to delete album:", err);
      alert("Failed to delete album. Please try again.");
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center">
        Loading Gallery...
      </div>
    );
  }

  // Show empty state instead of error - the page will still be usable
  // This allows admins to see the page even if Firebase isn't configured
  if (error && albums.length === 0 && media.length === 0) {
    console.warn("Gallery loading error:", error);
    // Don't show error, just continue with empty data
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
