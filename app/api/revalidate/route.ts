/**
 * Revalidate API
 * /api/revalidate - Force revalidation of cached pages
 *
 * Admin-only: the homepage settings form calls this after a save so changes appear
 * immediately. Anonymous callers could otherwise churn the cache on demand.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { requireAdminUser } from "@/lib/auth/admin-auth";

// POST /api/revalidate - Revalidate specified paths
export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { paths } = body;

    if (!paths || !Array.isArray(paths)) {
      // Default: revalidate homepage
      revalidatePath("/");
      return NextResponse.json({ 
        revalidated: true, 
        paths: ["/"],
        timestamp: new Date().toISOString()
      });
    }

    // Revalidate specified paths
    for (const path of paths) {
      if (typeof path === "string") {
        revalidatePath(path);
      }
    }

    return NextResponse.json({ 
      revalidated: true, 
      paths,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[Revalidate API] Error:", error);
    return NextResponse.json(
      { error: "Failed to revalidate", details: error.message },
      { status: 500 }
    );
  }
}
