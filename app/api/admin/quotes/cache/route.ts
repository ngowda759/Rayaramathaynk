/**
 * Admin Quote Cache API
 * /api/admin/quotes/cache - Manage quote cache
 */

import { NextResponse } from "next/server";
import { quoteService } from "@/services/quote.service";

// POST /api/admin/quotes/cache - Clear quote cache
export async function POST() {
  try {
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
