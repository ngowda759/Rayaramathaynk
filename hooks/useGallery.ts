"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { GalleryMedia } from "@/types/gallery";

export function useGallery(
  featuredOnly = false,
  albumId?: string
) {
  const [media, setMedia] = useState<GalleryMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      // Use setTimeout to avoid synchronous state update during effect
      setTimeout(() => setLoading(false), 0);
      return;
    }

    let q;

    if (albumId) {
      q = query(
        collection(db, "galleryMedia"),
        where("albumId", "==", albumId),
        orderBy("displayOrder", "asc")
      );
    } else {
      q = query(
        collection(db, "galleryMedia"),
        orderBy("displayOrder", "asc")
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<GalleryMedia, "id">),
        }));

        if (featuredOnly) {
          items = items.filter((item) => item.isFeatured);
        }

        setMedia(items);
        // Use setTimeout to avoid synchronous state update during effect
        setTimeout(() => setLoading(false), 0);
      },
      (error) => {
        console.error("Gallery listener:", error);
        setTimeout(() => setLoading(false), 0);
      }
    );

    return () => unsubscribe();
  }, [featuredOnly, albumId]);

  return {
    media,
    loading,
  };
}
