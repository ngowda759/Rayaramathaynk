import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Ekadashi Schedule",
  description:
    "Sri Parabhava Samvatsara Ekadashi calendar observed at Sri Raghavendra Swamy Matha, Yelahanka New Town.",
  path: "/calendar/ekadashi",
});

export default function EkadashiCalendarLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
