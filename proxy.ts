import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

// Firebase config for proxy (server-side)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBJPt69fwPfcMLvSYMG28Jv64orqenNeC4",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "sri-raghavendra-mutt.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sri-raghavendra-mutt",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sri-raghavendra-mutt.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "231035009940",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:231035009940:web:dbc2c3b714c76ddb73ed81",
};

// Initialize Firebase for proxy
let db: ReturnType<typeof getFirestore> | null = null;

function initFirebase() {
  if (!db) {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      db = getFirestore(app);
    } catch (error) {
      console.error("Firebase init error in proxy:", error);
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

    await addDoc(collection(firestore, "page_views"), pageViewData);
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

  // For auth paths (login/register), always allow through
  // Firebase auth is handled client-side, so we don't redirect here
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

  // Create response and add security headers
  const response = NextResponse.next();

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
