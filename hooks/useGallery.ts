"use client";

import { useEffect, useState } from "react";

import { GalleryMedia } from "@/types/gallery";
import { galleryService } from "@/services/gallery.service";

export function useGallery(
  featuredOnly = false,
  albumId?: string
) {
  const [media, setMedia] = useState<GalleryMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGallery() {
      try {
        let items: GalleryMedia[];

        if (albumId) {
          items = await galleryService.getMediaByAlbum(albumId);
        } else {
          items = await galleryService.getMedia();
        }

        if (featuredOnly) {
          items = items.filter((item) => item.isFeatured);
        }

        setMedia(items);
      } catch (error) {
        console.error("Error loading gallery:", error);
      } finally {
        setLoading(false);
      }
    }

    loadGallery();
  }, [featuredOnly, albumId]);

  return {
    media,
    loading,
  };
}
