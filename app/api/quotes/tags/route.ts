/**
 * Quote Tags API
 * /api/quotes/tags - Get all unique tags
 */

import { NextResponse } from "next/server";
import { quoteService } from "@/services/quote.service";

// GET /api/quotes/tags
export async function GET() {
  try {
    const tags = await quoteService.getAllTags();

    return NextResponse.json({
      tags,
      total: tags.length,
    });
  } catch (error: any) {
    console.error("[Quote Tags API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tags", details: error.message },
      { status: 500 }
    );
  }
}
