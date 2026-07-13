import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Security headers configuration
const securityHeaders = {
  "X-DNS-Prefetch-Control": "on",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.firebaseapp.com https://images.unsplash.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://*.google.com https://*.googleusercontent.com https://api.stripe.com; frame-src 'self' https://www.google.com https://maps.google.com https://js.stripe.com https://hooks.stripe.com;",
};

function proxy(request: NextRequest) {
  // Create response and add security headers
  const response = NextResponse.next();

  // Apply security headers to all responses
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|api/).*)",
  ],
};
