"use client";

import { useEffect, useState } from "react";

import { galleryService } from "@/services/gallery.service";
import { GalleryMedia } from "@/types/gallery";

/**
 * Gallery media for the public site.
 *
 * Reads Supabase `gallery_media` through `galleryService`. There is no Firestore
 * `onSnapshot` listener: the media is loaded once when the filters change, and a failed
 * read leaves the list empty rather than falling back to Firestore.
 */
export function useGallery(featuredOnly = false, albumId?: string) {
  const [media, setMedia] = useState<GalleryMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const items = albumId
          ? await galleryService.getMediaByAlbum(albumId)
          : await galleryService.getMedia();
        if (cancelled) return;
        setMedia(featuredOnly ? items.filter((item) => item.isFeatured) : items);
      } catch (error) {
        console.error("Gallery load:", error);
        if (!cancelled) setMedia([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [featuredOnly, albumId]);

  return { media, loading };
}
