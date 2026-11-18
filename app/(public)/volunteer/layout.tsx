import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Become a Volunteer",
  description:
    "Join the volunteer (sevadhar) program at Sri Raghavendra Swamy Matha and offer your service to the temple and community.",
  path: "/volunteer",
});

export default function VolunteerLayout({ children }: { children: ReactNode }) {
  return children;
}
