import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Festival Calendar",
  description:
    "Sri Parabhava Samvatsara festival calendar of the major festivals celebrated at Sri Raghavendra Swamy Matha.",
  path: "/calendar/festivals",
});

export default function FestivalCalendarLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
