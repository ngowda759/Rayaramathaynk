import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/seo";

/**
 * robots.txt (App Router file convention).
 *
 * Public content is open to crawlers; the admin console, the Seva Entry module,
 * API routes and other non-content areas are kept out. The canonical sitemap is
 * declared so crawlers find it directly.
 *
 * `/seva$` is anchored so it matches the Seva Entry root only, never the public
 * `/sevas` page (robots prefix matching would otherwise let `/seva` swallow it).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        // The OAuth/PKCE callback: a single-use code in the URL must never be crawled or cached.
        "/auth/",
        "/seva$",
        "/seva/",
        "/debug/",
        "/r/",
        "/profile/",
        "/receipts/",
        "/favorites/",
        "/pages/",
        "/notifications",
        "/search",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
