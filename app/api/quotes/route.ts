/**
 * Public Quote API Routes
 * /api/quotes/* - Public endpoints for quote retrieval
 */

import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/services/quote.service";
import { QuoteCategory } from "@/types/quote";

// GET /api/quotes - Get quotes with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as QuoteCategory | null;
    const featured = searchParams.get("featured");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const filters: any = {
      active: true,
    };

    if (category) {
      filters.category = category;
    }

    if (featured === "true") {
      filters.featured = true;
    }

    if (search) {
      filters.search = search;
    }

    const quotes = await quoteService.getQuotes(filters);

    return NextResponse.json({
      quotes: quotes.slice(0, limit),
      total: quotes.length,
      filters: { category, featured, search },
    });
  } catch (error: any) {
    console.error("[Quote API] Error fetching quotes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotes", details: error.message },
      { status: 500 }
    );
  }
}
