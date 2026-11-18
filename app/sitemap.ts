import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/seo";

/**
 * sitemap.xml (App Router file convention).
 *
 * Only public content routes are listed. The admin console, the Seva Entry module
 * (`/seva`, auth-guarded), API routes, debug and user-specific pages (`/profile`,
 * `/favorites`, `/receipts`, `/search`) are intentionally excluded.
 *
 * Dynamic event detail pages (`/events/[id]`) are not included: the public read
 * path is a runtime, client-side query, and the sitemap must not add a new
 * database-query architecture of its own (see the task scope).
 */
type ChangeFrequency = MetadataRoute.Sitemap[number]["changeFrequency"];

interface PublicRoute {
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}

const PUBLIC_ROUTES: PublicRoute[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/events", changeFrequency: "daily", priority: 0.9 },
  { path: "/donation", changeFrequency: "monthly", priority: 0.9 },
  { path: "/sevas", changeFrequency: "weekly", priority: 0.8 },
  { path: "/about", changeFrequency: "monthly", priority: 0.8 },
  { path: "/aaradhane", changeFrequency: "monthly", priority: 0.8 },
  { path: "/gallery", changeFrequency: "weekly", priority: 0.7 },
  { path: "/pooja", changeFrequency: "weekly", priority: 0.7 },
  { path: "/facilities", changeFrequency: "monthly", priority: 0.7 },
  { path: "/volunteer", changeFrequency: "monthly", priority: 0.7 },
  { path: "/calendar", changeFrequency: "weekly", priority: 0.7 },
  { path: "/calendar/festivals", changeFrequency: "weekly", priority: 0.7 },
  { path: "/calendar/ekadashi", changeFrequency: "weekly", priority: 0.7 },
  { path: "/trust", changeFrequency: "monthly", priority: 0.6 },
  { path: "/guruparampara", changeFrequency: "monthly", priority: 0.6 },
  { path: "/shlokas", changeFrequency: "monthly", priority: 0.6 },
  { path: "/stotras", changeFrequency: "monthly", priority: 0.6 },
  { path: "/knowledge", changeFrequency: "monthly", priority: 0.6 },
  { path: "/live", changeFrequency: "weekly", priority: 0.6 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.6 },
  { path: "/temple-explorer", changeFrequency: "monthly", priority: 0.5 },
  { path: "/future-plans", changeFrequency: "monthly", priority: 0.5 },
  { path: "/journey", changeFrequency: "monthly", priority: 0.5 },
  { path: "/timeline", changeFrequency: "monthly", priority: 0.5 },
  { path: "/quotes", changeFrequency: "weekly", priority: 0.5 },
  { path: "/testimonials", changeFrequency: "monthly", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
