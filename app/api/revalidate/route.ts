/**
 * Revalidate API
 * /api/revalidate - Force revalidation of cached pages
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

// POST /api/revalidate - Revalidate specified paths
export async function POST(request: NextRequest) {
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
