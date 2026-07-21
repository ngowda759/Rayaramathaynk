/**
 * Quote by Category API
 * /api/quotes/category/[category] - Get quotes by category
 */

import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/services/quote.service";
import { QuoteCategory } from "@/types/quote";

const VALID_CATEGORIES: QuoteCategory[] = [
  "raghavendra_stotra",
  "mangalashtakam",
  "guru_vandana",
  "authentic_teachings",
  "devotional_sayings",
  "madhwa_philosophy",
];

// GET /api/quotes/category/[category]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params;
    
    if (!VALID_CATEGORIES.includes(category as QuoteCategory)) {
      return NextResponse.json(
        { 
          error: "Invalid category",
          validCategories: VALID_CATEGORIES 
        },
        { status: 400 }
      );
    }

    const quotes = await quoteService.getQuoteByCategory(category as QuoteCategory);

    return NextResponse.json({
      category,
      quotes,
      total: quotes.length,
    });
  } catch (error: any) {
    console.error("[Quote Category API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotes by category", details: error.message },
      { status: 500 }
    );
  }
}
