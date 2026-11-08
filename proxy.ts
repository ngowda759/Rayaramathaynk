import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Security headers configuration
const securityHeaders = {
  "X-DNS-Prefetch-Control": "on",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.firebaseapp.com https://images.unsplash.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://*.google.com https://*.googleapis.com https://*.googleusercontent.com https://api.stripe.com https://*.supabase.co wss://*.supabase.co; frame-src 'self' https://www.google.com https://maps.google.com https://js.stripe.com https://hooks.stripe.com;",
};

// Static file extensions to exclude from checks
const STATIC_EXTENSIONS = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp)$/;

// Paths that should allow through
const AUTH_PATHS = ["/login", "/register"];

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Check if this is a static file or API route
  const isStaticFile = STATIC_EXTENSIONS.test(pathname);
  const isApiRoute = pathname.startsWith("/api/");
  
  // Check if path is auth path
  const isAuthPath = AUTH_PATHS.includes(pathname);

  // For auth paths (login/register), always allow through
  if (isAuthPath) {
    const response = NextResponse.next();
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  // Create response and add security headers
  const response = NextResponse.next();

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
