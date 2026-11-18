import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Live Darshan",
  description:
    "Watch live darshan and recorded celebrations from Sri Raghavendra Swamy Matha, Yelahanka New Town.",
  path: "/live",
});

export default function LiveLayout({ children }: { children: ReactNode }) {
  return children;
}
