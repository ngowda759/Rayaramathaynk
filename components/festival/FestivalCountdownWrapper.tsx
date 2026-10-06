"use client";

import { useMemo } from "react";
import FestivalCountdown from "./FestivalCountdown";
import { getFeaturedFestival } from "@/types/festival";
import { getAllFestivals } from "@/lib/festival-utils";

export default function FestivalCountdownWrapper() {
  const featuredFestival = useMemo(() => {
    const festivals = getAllFestivals();
    return getFeaturedFestival(festivals);
  }, []);

  if (!featuredFestival) {
    return null;
  }

  return (
    <div className="w-full max-w-md mx-auto my-8">
      <FestivalCountdown festival={featuredFestival} />
    </div>
  );
}
