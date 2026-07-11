import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const protectedRoutes = ["/admin"];

// Routes that require specific roles
const adminRoutes = ["/admin/settings", "/admin/users", "/admin/reports", "/admin/billing"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // TEMPORARILY DISABLED: Auth protection for debugging
  // TODO: Re-enable after fixing Firebase session cookie issues
  // Uncomment the following block to re-enable:
  
  /*
  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Check for any auth-related cookies
  const hasAuthCookie = request.cookies.getAll().some(
    (cookie) =>
      cookie.name.startsWith("firebase-") ||
      cookie.name === "session" ||
      cookie.name === "__session"
  );

  // If accessing protected route without auth indicator, redirect to login
  if (!hasAuthCookie && pathname.startsWith("/admin")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }
  */

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
     * - api routes (except protected admin APIs)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api(?!/admin)).*)",
  ],
};
