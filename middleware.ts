import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This middleware is temporarily disabled
// Client-side AdminAuthGuard handles authentication

export function middleware(request: NextRequest) {
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
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api/).*)",
  ],
};
