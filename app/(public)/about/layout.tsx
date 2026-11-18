import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About the Matha",
  description:
    "Learn about the history, mission and activities of Sri Raghavendra Swamy Matha, Yelahanka New Town, Bengaluru.",
  path: "/about",
});

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
