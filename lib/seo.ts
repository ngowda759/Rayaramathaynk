import type { Metadata } from "next";

/**
 * Site-wide SEO constants and a small helper for per-page metadata.
 *
 * The canonical production domain is a single source of truth here so every
 * `canonical`/`og:url` value points at the same host (the `www` form the root
 * layout already sets as `metadataBase`). Canonical paths are relative, so a
 * request on the apex host or with a query string still resolves to one URL.
 */
export const SITE_URL = "https://www.srsmathaynk.com";

export const SITE_NAME = "Sri Raghavendra Swamy Matha";

export const SITE_DESCRIPTION =
  "Official website and Temple Management Portal of Sri Raghavendra Swamy Temple, Yelahanka New Town.";

/** The Open Graph/Twitter preview image shared by every route (also used by the root layout). */
export const SOCIAL_PREVIEW_IMAGE = {
  url: "/images/logos/social-preview.png",
  width: 1200,
  height: 630,
  alt: "Sri Raghavendra Swamy Matha",
} as const;

interface PageMetadataInput {
  /** Page title. Combined with the root layout's title template unless `absolute` is set. */
  title: string;
  description: string;
  /** Root-relative route path, used verbatim as the canonical URL (no query string). */
  path: string;
  /** Set for the homepage, which must not inherit the `%s | …` title template. */
  absolute?: boolean;
}

/**
 * Build page-specific metadata (title, description, canonical, Open Graph, Twitter).
 *
 * Open Graph is set explicitly rather than left to inherit, so `og:url` and
 * `og:title` match the page while the shared preview image and locale are kept.
 */
export function pageMetadata({
  title,
  description,
  path,
  absolute = false,
}: PageMetadataInput): Metadata {
  const socialTitle = absolute ? title : `${title} | ${SITE_NAME}`;

  return {
    title: absolute ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: socialTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      images: [SOCIAL_PREVIEW_IMAGE],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [SOCIAL_PREVIEW_IMAGE.url],
    },
  };
}
