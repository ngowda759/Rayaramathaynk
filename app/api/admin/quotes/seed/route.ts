/**
 * Admin Quote Seed API
 * /api/admin/quotes/seed - Seed default quotes
 */

import { NextResponse } from "next/server";
import { quoteService } from "@/services/quote.service";

// POST /api/admin/quotes/seed - Seed default quotes
export async function POST() {
  try {
    const seeded = await quoteService.seedDefaultQuotes();

    return NextResponse.json({
      message: `Seeded ${seeded} default quotes`,
      seeded,
    });
  } catch (error: any) {
    console.error("[Admin Quote Seed API] Error:", error);
    return NextResponse.json(
      { error: "Failed to seed quotes", details: error.message },
      { status: 500 }
    );
  }
}
