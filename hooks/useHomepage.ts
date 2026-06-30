"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { HomepageConfig } from "@/types/homepage";
import { homepageService } from "@/services/homepage.service";

export function useHomepage() {
  const [homepage, setHomepage] = useState<HomepageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let initialized = false;

    const unsubscribe = onSnapshot(
      doc(db, "homepage", "config"),
      async (snapshot) => {
        try {
          if (snapshot.exists()) {
            setHomepage({
              ...homepageService.getDefaultConfig(),
              ...(snapshot.data() as HomepageConfig),
            });
          } else {
            setHomepage(homepageService.getDefaultConfig());
          }
        } catch (error) {
          console.error("Homepage listener:", error);
          setHomepage(homepageService.getDefaultConfig());
        } finally {
          if (!initialized) {
            initialized = true;
            setLoading(false);
          }
        }
      },
      (error) => {
        console.error("Homepage listener:", error);
        setHomepage(homepageService.getDefaultConfig());
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    homepage,
    loading,
  };
}
