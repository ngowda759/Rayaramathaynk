import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
let supabaseHost = "*.supabase.co";
try {
  supabaseHost = new URL(supabaseUrl).hostname;
} catch (e) {
  // Ignore
}

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
    value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.firebaseapp.com https://images.unsplash.com https://${supabaseHost}; media-src 'self' blob: data: https://*.googleapis.com https://${supabaseHost}; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://*.google.com https://*.googleusercontent.com https://api.stripe.com https://api.openai.com https://openrouter.ai https://api.anthropic.com https://generativelanguage.googleapis.com https://${supabaseHost}; frame-src 'self' https://www.google.com https://maps.google.com https://js.stripe.com https://hooks.stripe.com https://www.youtube.com https://youtube.com;`,
  },
];

const cacheHeaders = [
  {
    key: "Cache-Control",
    value: "no-cache, no-store, must-revalidate, proxy-revalidate"
  }
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
        hostname: supabaseHost,
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/data/panchanga/current.json",
        headers: cacheHeaders,
      },
      {
        source: "/data/panchanga/:path*",
        headers: cacheHeaders,
      },
    ];
  },
};

export default nextConfig;
