/**
 * Featured Quotes API
 * /api/quotes/featured - Get featured quotes
 */

import { NextResponse } from "next/server";
import { quoteService } from "@/services/quote.service";

// GET /api/quotes/featured
export async function GET() {
  try {
    const quotes = await quoteService.getFeaturedQuotes();

    return NextResponse.json({
      quotes,
      total: quotes.length,
    });
  } catch (error: any) {
    console.error("[Quote Featured API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch featured quotes", details: error.message },
      { status: 500 }
    );
  }
}
