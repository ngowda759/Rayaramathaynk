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
        setLoading(false);
      },
      (error) => {
        console.error("Gallery listener:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [featuredOnly, albumId]);

  return {
    media,
    loading,
  };
}
