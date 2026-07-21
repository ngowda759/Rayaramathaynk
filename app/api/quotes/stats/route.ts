/**
 * Quote Statistics API
 * /api/quotes/stats - Get quote statistics
 */

import { NextResponse } from "next/server";
import { quoteService } from "@/services/quote.service";

// GET /api/quotes/stats
export async function GET() {
  try {
    const stats = await quoteService.getQuoteStats();

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error("[Quote Stats API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote statistics", details: error.message },
      { status: 500 }
    );
  }
}
