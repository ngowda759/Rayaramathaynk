import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Trust Committee",
  description:
    "Meet the trust committee of Sri Raghavendra Swamy Matha, Yelahanka New Town, Bengaluru.",
  path: "/trust",
});

export default function TrustLayout({ children }: { children: ReactNode }) {
  return children;
}
