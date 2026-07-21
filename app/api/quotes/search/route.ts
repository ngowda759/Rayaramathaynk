/**
 * Quote Search API
 * /api/quotes/search - Search quotes
 */

import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/services/quote.service";

// GET /api/quotes/search?q=searchterm
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: "Search query must be at least 2 characters" },
        { status: 400 }
      );
    }

    const quotes = await quoteService.searchQuotes(query.trim());

    return NextResponse.json({
      query,
      quotes,
      total: quotes.length,
    });
  } catch (error: any) {
    console.error("[Quote Search API] Error:", error);
    return NextResponse.json(
      { error: "Failed to search quotes", details: error.message },
      { status: 500 }
    );
  }
}
