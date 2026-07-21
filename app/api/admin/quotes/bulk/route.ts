/**
 * Admin Bulk Import/Export API
 * /api/admin/quotes/bulk - Bulk import and export quotes
 */

import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/services/quote.service";
import { auth } from "@/lib/auth";
import { QuoteBulkData } from "@/types/quote";

// POST /api/admin/quotes/bulk - Bulk import quotes
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { quotes, mode } = body;

    if (!quotes || !Array.isArray(quotes)) {
      return NextResponse.json(
        { error: "quotes array is required" },
        { status: 400 }
      );
    }

    if (mode === "validate") {
      // Validation only mode
      const errors: string[] = [];
      quotes.forEach((q: any, i: number) => {
        if (!q.title) errors.push(`Quote ${i}: Missing title`);
        if (!q.category) errors.push(`Quote ${i}: Missing category`);
        if (!q.source) errors.push(`Quote ${i}: Missing source`);
        if (q.category && !["raghavendra_stotra", "mangalashtakam", "guru_vandana", "authentic_teachings", "devotional_sayings", "madhwa_philosophy"].includes(q.category)) {
          errors.push(`Quote ${i}: Invalid category`);
        }
      });
      return NextResponse.json({
        valid: quotes.length - errors.length,
        errors,
        total: quotes.length,
      });
    }

    // Import mode
    const result = await quoteService.bulkImport(quotes);

    // Clear cache after bulk import
    quoteService.clearCache();

    return NextResponse.json({
      imported: result.imported,
      errors: result.errors,
      total: quotes.length,
    });
  } catch (error: any) {
    console.error("[Admin Bulk Import API] Error:", error);
    return NextResponse.json(
      { error: "Failed to import quotes", details: error.message },
      { status: 500 }
    );
  }
}

// GET /api/admin/quotes/bulk - Export quotes
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const activeOnly = searchParams.get("activeOnly") !== "false";

    const filters: any = { active: activeOnly };
    if (category) filters.category = category;

    const quotes = await quoteService.getQuotes(filters);

    const exportData: QuoteBulkData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      quotes: quotes.map(({ id, createdAt, updatedAt, ...rest }) => rest),
    };

    return NextResponse.json(exportData, {
      headers: {
        "Content-Disposition": `attachment; filename="quotes-export-${getDateString()}.json"`,
      },
    });
  } catch (error: any) {
    console.error("[Admin Bulk Export API] Error:", error);
    return NextResponse.json(
      { error: "Failed to export quotes", details: error.message },
      { status: 500 }
    );
  }
}

function getDateString(): string {
  return new Date().toISOString().split("T")[0];
}
