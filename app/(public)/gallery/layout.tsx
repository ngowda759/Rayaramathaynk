import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Temple Gallery",
  description:
    "Photos and videos of celebrations, sevas and festivals at Sri Raghavendra Swamy Matha, Yelahanka New Town.",
  path: "/gallery",
});

export default function GalleryLayout({ children }: { children: ReactNode }) {
  return children;
}
