/**
 * Admin Quote Cache API
 * /api/admin/quotes/cache - Manage quote cache
 */

import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/services/quote.server";
import { verifyAdminUser } from "@/lib/auth/admin-auth";

// POST /api/admin/quotes/cache - Clear quote cache
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminUser(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    quoteService.clearCache();

    return NextResponse.json({
      message: "Quote cache cleared successfully",
    });
  } catch (error: any) {
    console.error("[Admin Quote Cache API] Error:", error);
    return NextResponse.json(
      { error: "Failed to clear cache", details: error.message },
      { status: 500 }
    );
  }
}
