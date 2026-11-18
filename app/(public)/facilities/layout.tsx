import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Matha Facilities",
  description:
    "Explore the facilities and amenities available to devotees at Sri Raghavendra Swamy Matha, Yelahanka New Town.",
  path: "/facilities",
});

export default function FacilitiesLayout({ children }: { children: ReactNode }) {
  return children;
}
