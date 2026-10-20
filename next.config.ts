import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "origin-when-cross-origin",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.firebaseapp.com https://images.unsplash.com https://*.blob.vercel-storage.com https://*.public.vercel-storage.com; media-src 'self' blob: data: https://*.googleapis.com https://*.blob.vercel-storage.com https://*.public.vercel-storage.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://*.google.com https://*.googleusercontent.com https://api.stripe.com https://api.openai.com https://openrouter.ai https://api.anthropic.com https://generativelanguage.googleapis.com https://*.vercel-storage.com; frame-src 'self' https://www.google.com https://maps.google.com https://js.stripe.com https://hooks.stripe.com https://www.youtube.com https://youtube.com;",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "*.public.vercel-storage.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  /**
   * Seva Entry moved from /admin/receipts and /admin/prasadam to /seva (plan A4S-1); old bookmarks and links forward
   * to the same page, and Next passes the query through. Literal on purpose: this file does not import
   * lib/seva/routes.ts (module resolution here is limited), and tests/unit/seva/legacy-redirects.test.ts pins these
   * rules to SEVA_ROUTES. Temporary (307) until go-live, so a revert is never stuck in a browser cache.
   */
  async redirects() {
    return [
      { source: "/admin/receipts", destination: "/seva", permanent: false },
      { source: "/admin/receipts/:path+", destination: "/seva/:path+", permanent: false },
      { source: "/admin/prasadam", destination: "/seva/prasadam", permanent: false },
    ];
  },
};

export default nextConfig;
