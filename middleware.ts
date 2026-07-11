import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const protectedRoutes = ["/admin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Check for any auth-related cookies from Firebase or custom session
  const cookies = request.cookies.getAll();
  const hasFirebaseAuthCookie = cookies.some(
    (cookie) => cookie.name.startsWith("firebase-")
  );
  const hasSessionCookie = cookies.some(
    (cookie) =>
      cookie.name === "session" ||
      cookie.name === "__session" ||
      cookie.name === "auth-token"
  );

  // If accessing protected route without auth indicator, redirect to login
  if (!hasFirebaseAuthCookie && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    
    // Add header to indicate why redirect happened (for client-side handling)
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("X-Auth-Redirect", "true");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes
     * - auth routes (login, register, forgot-password)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api/|login|register|forgot-password).*)",
  ],
};
