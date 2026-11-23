/**
 * Admin Quote Seed API
 * /api/admin/quotes/seed - Seed default quotes
 */

import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/services/quote.server";
import { requireAdminCapability } from "@/lib/auth/admin-capabilities";

// POST /api/admin/quotes/seed - Seed default quotes
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminCapability(request, "quotes.write");
    if (!auth.ok) return auth.response;
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
