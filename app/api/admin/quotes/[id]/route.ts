/**
 * Admin Single Quote API
 * /api/admin/quotes/[id] - Single quote operations
 */

import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/services/quote.service";
import { auth } from "@/lib/auth";

// GET /api/admin/quotes/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const quote = await quoteService.getQuoteById(id);

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    return NextResponse.json({ quote });
  } catch (error: any) {
    console.error("[Admin Quote API] Error fetching quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote", details: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/admin/quotes/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.category || !body.source) {
      return NextResponse.json(
        { error: "Missing required fields: title, category, source" },
        { status: 400 }
      );
    }

    await quoteService.updateQuote(id, body);

    // Clear cache after update
    quoteService.clearCache();

    return NextResponse.json({ message: "Quote updated successfully" });
  } catch (error: any) {
    console.error("[Admin Quote API] Error updating quote:", error);
    return NextResponse.json(
      { error: "Failed to update quote", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/quotes/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await quoteService.deleteQuote(id);

    // Clear cache after delete
    quoteService.clearCache();

    return NextResponse.json({ message: "Quote deleted successfully" });
  } catch (error: any) {
    console.error("[Admin Quote API] Error deleting quote:", error);
    return NextResponse.json(
      { error: "Failed to delete quote", details: error.message },
      { status: 500 }
    );
  }
}
