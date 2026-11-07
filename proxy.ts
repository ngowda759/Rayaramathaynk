import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Security headers configuration
const securityHeaders = {
  "X-DNS-Prefetch-Control": "on",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.firebaseapp.com https://images.unsplash.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://*.google.com https://*.googleapis.com https://*.googleapis.com https://*.googleusercontent.com https://api.stripe.com https://*.supabase.co wss://*.supabase.co; frame-src 'self' https://www.google.com https://maps.google.com https://js.stripe.com https://hooks.stripe.com;",
};

async function trackPageView(request: NextRequest, pathname: string) {
  try {
    const pageViewData = {
      path: pathname,
      referrer: request.headers.get("referer") || "direct",
      deviceType: "desktop",
      language: "en",
      country: "unknown",
      visitorId: null
    };

    await fetch(request.nextUrl.origin + "/api/public/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pageViewData),
    });
  } catch (error) {
    console.error("Error tracking page view:", error);
  }
}

// Static file extensions to exclude from auth checks
const STATIC_EXTENSIONS = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp)$/;

// Paths that should allow through (auth is handled client-side)
const AUTH_PATHS = ["/login", "/register"];

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Check if this is a static file or API route
  const isStaticFile = STATIC_EXTENSIONS.test(pathname);
  const isApiRoute = pathname.startsWith("/api/");
  
  // Check if path is auth path
  const isAuthPath = AUTH_PATHS.includes(pathname);

  if (isAuthPath) {
    const response = NextResponse.next();
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  // Track page view for GET requests (exclude static files, API routes)
  if (
    request.method === "GET" &&
    !isStaticFile &&
    !isApiRoute
  ) {
    trackPageView(request, pathname).catch(() => {});
  }

  const response = NextResponse.next();

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
