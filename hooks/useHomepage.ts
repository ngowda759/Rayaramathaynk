"use client";

import { useEffect, useState } from "react";

import { HomepageConfig } from "@/types/homepage";
import { homepageService } from "@/services/homepage.service";

export function useHomepage() {
  const [homepage, setHomepage] = useState<HomepageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHomepage() {
      try {
        const data = await homepageService.getHomepage();
        setHomepage(data);
      } catch (error) {
        console.error("Error loading homepage:", error);
        setHomepage(homepageService.getDefaultConfig());
      } finally {
        setLoading(false);
      }
    }

    loadHomepage();
  }, []);

  return {
    homepage,
    loading,
  };
}
