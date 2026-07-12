"use client";

import { useEffect, useState } from "react";

import { HomepageConfig } from "@/types/homepage";
import { homepageService } from "@/services/homepage.service";

export function useHomepage() {
  const [homepage, setHomepage] = useState<HomepageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set default config immediately
    setHomepage(homepageService.getDefaultConfig());
    setLoading(false);

    // Try to load from Firebase if available
    async function loadFromFirebase() {
      try {
        // Dynamic import to avoid issues if firebase is not configured
        const { doc, onSnapshot } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        
        if (!db) {
          console.log("Firebase not configured - using default homepage config");
          return;
        }

        const unsubscribe = onSnapshot(
          doc(db, "homepage", "config"),
          (snapshot) => {
            try {
              if (snapshot.exists()) {
                setHomepage({
                  ...homepageService.getDefaultConfig(),
                  ...(snapshot.data() as HomepageConfig),
                });
              }
              setLoading(false);
            } catch (error) {
              console.error("Homepage listener:", error);
            }
          },
          (error) => {
            console.error("Homepage listener error:", error);
          }
        );

        return unsubscribe;
      } catch (error) {
        console.log("Firebase not available - using default homepage config");
      }
    }

    const unsubscribePromise = loadFromFirebase();
    
    return () => {
      unsubscribePromise.then(unsub => {
        if (unsub) unsub();
      }).catch(() => {});
    };
  }, []);

  return {
    homepage,
    loading,
  };
}
