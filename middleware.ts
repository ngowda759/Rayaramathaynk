import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Security headers configuration
const securityHeaders = {
  "X-DNS-Prefetch-Control": "on",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://*.firebaseapp.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.firebaseapp.com https://images.unsplash.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://*.google.com https://*.googleusercontent.com; frame-src 'self' https://www.google.com https://maps.google.com;",
};

// Routes that require authentication
const protectedRoutes = ["/admin"];

// Routes that don't require authentication
const publicRoutes = ["/login", "/register", "/forgot-password", "/"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Create response and add security headers
  const response = NextResponse.next();

  // Apply security headers to all responses
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Allow public routes
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + "/"))) {
    return response;
  }

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return response;
  }

  // For protected routes, we can't check auth on server side with Firebase
  // Client-side AdminAuthGuard will handle this
  // For now, allow access and let client-side handle auth
  
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|api/).*)",
  ],
};
