/**
 * Quote Preview API
 * /api/quotes/preview - Preview upcoming quotes for rotation
 */

import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/services/quote.service";

// GET /api/quotes/preview?days=7
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get("days") || "7", 10), 30);

    const preview = await quoteService.getRotationPreview(days);

    return NextResponse.json({
      preview,
      total: preview.length,
    });
  } catch (error: any) {
    console.error("[Quote Preview API] Error:", error);
    return NextResponse.json(
      { error: "Failed to get quote preview", details: error.message },
      { status: 500 }
    );
  }
}
