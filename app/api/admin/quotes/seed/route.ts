/**
 * Admin Quote Seed API
 * /api/admin/quotes/seed - Seed default quotes
 */

import { NextResponse } from "next/server";
import { quoteService } from "@/services/quote.service";
import { auth } from "@/lib/auth";

// POST /api/admin/quotes/seed - Seed default quotes
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
