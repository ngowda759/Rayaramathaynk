"use client";

import { useEffect, useState } from "react";

import { HomepageConfig } from "@/types/homepage";
import { homepageService } from "@/services/homepage.service";

/**
 * Public homepage configuration.
 *
 * Fetches `/api/public/homepage` (the server reads `settings_documents` with the
 * service-role client and falls back to defaults). The built-in defaults are shown
 * immediately so the first paint is never blank, then replaced by the saved values.
 * There is no Firestore listener.
 */
export function useHomepage() {
  const [homepage, setHomepage] = useState<HomepageConfig | null>(
    homepageService.getDefaultConfig()
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/public/homepage");
        if (response.ok) {
          const data = (await response.json()) as HomepageConfig;
          if (!cancelled) {
            setHomepage({ ...homepageService.getDefaultConfig(), ...data });
          }
        }
      } catch (error) {
        console.error("[useHomepage] Failed to load homepage settings:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { homepage, loading };
}
