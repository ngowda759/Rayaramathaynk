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

  // Note: Firebase Authentication uses browser state (localStorage) not cookies.
  // The client-side AdminAuthGuard handles the actual authentication check.
  // Middleware only adds a header for logging/debugging purposes.
  
  // Add header to indicate protected route access (for debugging)
  const response = NextResponse.next();
  response.headers.set("X-Protected-Route", "true");
  return response;
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
