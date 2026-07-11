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

      console.log("Gallery data loaded:", { albums: albumData.length, media: mediaData.length });
      console.log("Albums:", albumData);
      console.log("Media:", mediaData);

       
      setAlbums(albumData);
       
      setMedia(mediaData);
    } catch (err: any) {
      console.error("Failed to load gallery:", err);
      const errorMessage = err?.message || err?.code || "Unknown error";
      console.log("Error details:", errorMessage);
       
      setError(`Failed to load gallery: ${errorMessage}`);
    } finally {
       
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Show empty state when there's no data
  const isEmpty = albums.length === 0 && media.length === 0;

  return (
    <div className="space-y-8">

      {isEmpty && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-gray-500 mb-4">No gallery data found. The collections may not exist in Firebase or contain no data.</p>
          <button
            onClick={load}
            className="rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600"
          >
            Refresh
          </button>
        </div>
      )}

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
