/**
 * Random Quote API
 * /api/quotes/random - Get a random quote
 */

import { NextResponse } from "next/server";
import { quoteService } from "@/services/quote.service";

// GET /api/quotes/random
export async function GET() {
  try {
    const quote = await quoteService.getRandomQuote();

    if (!quote) {
      return NextResponse.json(
        { error: "No quotes found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ quote });
  } catch (error: any) {
    console.error("[Quote Random API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch random quote", details: error.message },
      { status: 500 }
    );
  }
}
