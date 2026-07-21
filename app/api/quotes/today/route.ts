/**
 * Today's Quote API
 * /api/quotes/today - Get today's devotional quote
 */

import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/services/quote.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/quotes/today - Get today's quote
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");

    let date: Date | undefined;
    if (dateStr) {
      date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format. Use YYYY-MM-DD." },
          { status: 400 }
        );
      }
    }

    const result = await quoteService.getTodaysQuote(date);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch (error: any) {
    console.error("[Quote Today API] Error:", error);
    return NextResponse.json(
      { error: "Failed to get today's quote", details: error.message },
      { status: 500 }
    );
  }
}
