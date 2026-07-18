import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

// Firebase config for middleware (server-side)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBJPt69fwPfcMLvSYMG28Jv64orqenNeC4",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "sri-raghavendra-mutt.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sri-raghavendra-mutt",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sri-raghavendra-mutt.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "231035009940",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:231035009940:web:dbc2c3b714c76ddb73ed81",
};

// Initialize Firebase for middleware
let db: ReturnType<typeof getFirestore> | null = null;

function initFirebase() {
  if (!db) {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      db = getFirestore(app);
    } catch (error) {
      console.error("Firebase init error in middleware:", error);
    }
  }
  return db;
}

// Security headers configuration
const securityHeaders = {
  "X-DNS-Prefetch-Control": "on",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.firebaseapp.com https://images.unsplash.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://*.google.com https://*.googleapis.com https://*.googleapis.com https://*.googleusercontent.com https://api.stripe.com; frame-src 'self' https://www.google.com https://maps.google.com https://js.stripe.com https://hooks.stripe.com;",
};

// Determine traffic source from request
function getTrafficSource(request: NextRequest): string {
  const referer = request.headers.get("referer") || "";

  if (!referer) return "direct";

  if (referer.includes("google.com") || referer.includes("bing.com") || referer.includes("yahoo.com")) {
    return "organic";
  }

  if (referer.includes("facebook.com") || referer.includes("twitter.com") || referer.includes("instagram.com") || referer.includes("linkedin.com")) {
    return "social";
  }

  return "referral";
}

async function trackPageView(request: NextRequest, pathname: string) {
  const firestore = initFirebase();
  if (!firestore) return;

  try {
    const pageViewData = {
      path: pathname,
      timestamp: Date.now(),
      source: getTrafficSource(request),
      userAgent: request.headers.get("user-agent") || "unknown",
      referer: request.headers.get("referer") || null,
      views: 1,
    };

    // Add to page_views collection
    await addDoc(collection(firestore, "page_views"), pageViewData);
  } catch (error) {
    // Silently fail - don't impact user experience
    console.error("Error tracking page view:", error);
  }
}

// Paths that require authentication
const PROTECTED_PATHS = ["/admin"];

// Paths that should redirect to /admin if already logged in
const AUTH_PATHS = ["/login", "/register"];

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isStaticFile = pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/);
  const isApiRoute = pathname.startsWith("/api/");

  // Check if path requires authentication
  const isProtectedPath = PROTECTED_PATHS.some(path => pathname.startsWith(path));
  const isAuthPath = AUTH_PATHS.includes(pathname);

  // Get auth status from cookies
  const hasFirebaseCookie = request.cookies.has("firebase-auth-token");
  const hasSessionCookie = request.cookies.has("__session");
  const isAuthenticated = hasFirebaseCookie || hasSessionCookie;

  // Redirect to login if accessing protected route without auth
  if (isProtectedPath && !isAuthenticated && !isStaticFile && !isApiRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to /admin if already logged in and accessing auth pages
  if (isAuthPath && isAuthenticated) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Track page view for GET requests (exclude static files, API routes, and admin routes)
  if (
    request.method === "GET" &&
    !isStaticFile &&
    !isApiRoute &&
    !isProtectedPath
  ) {
    // Fire and forget - don't await
    trackPageView(request, pathname).catch(() => {});
  }

  // Create response and add security headers
  const response = NextResponse.next();

  // Apply security headers to all responses
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|api/).*)",
  ],
};
