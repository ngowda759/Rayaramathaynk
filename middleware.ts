import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const protectedRoutes = ["/admin"];

// Routes that don't require authentication
const publicRoutes = ["/login", "/register", "/forgot-password", "/"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + "/"))) {
    return NextResponse.next();
  }

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // For protected routes, we can't check auth on server side with Firebase
  // Client-side AdminAuthGuard will handle this
  // For now, allow access and let client-side handle auth
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|api/).*)",
  ],
};
