/**
 * Admin Quote Management API
 * /api/admin/quotes - CRUD operations for quotes
 */

import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/services/quote.service";

// GET /api/admin/quotes - List all quotes with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const featured = searchParams.get("featured");
    const active = searchParams.get("active");
    const search = searchParams.get("search");

    const filters: any = {};

    if (category) filters.category = category;
    if (featured === "true") filters.featured = true;
    if (featured === "false") filters.featured = false;
    if (active === "true") filters.active = true;
    if (active === "false") filters.active = false;
    if (search) filters.search = search;

    // Get all quotes including inactive ones for admin
    const quotes = await quoteService.getQuotes(filters);

    return NextResponse.json({
      quotes,
      total: quotes.length,
    });
  } catch (error: any) {
    console.error("[Admin Quotes API] Error fetching quotes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotes", details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/admin/quotes - Create a new quote
export async function POST(request: NextRequest) {
  try {
    const userEmail = request.headers.get("x-user-email") || "admin";

    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.category || !body.source) {
      return NextResponse.json(
        { error: "Missing required fields: title, category, source" },
        { status: 400 }
      );
    }

    const id = await quoteService.createQuote({
      ...body,
      createdBy: userEmail,
    });

    return NextResponse.json({ id, message: "Quote created successfully" }, { status: 201 });
  } catch (error: any) {
    console.error("[Admin Quotes API] Error creating quote:", error);
    return NextResponse.json(
      { error: "Failed to create quote", details: error.message },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/quotes - Bulk update quotes
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, updates } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids array is required" },
        { status: 400 }
      );
    }

    const results = { updated: 0, errors: [] as string[] };

    for (const id of ids) {
      try {
        await quoteService.updateQuote(id, updates);
        results.updated++;
      } catch (error: any) {
        results.errors.push(`Quote ${id}: ${error.message}`);
      }
    }

    // Clear cache after bulk update
    quoteService.clearCache();

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("[Admin Quotes API] Error bulk updating quotes:", error);
    return NextResponse.json(
      { error: "Failed to update quotes", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/quotes - Bulk delete quotes
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids array is required" },
        { status: 400 }
      );
    }

    const results = { deleted: 0, errors: [] as string[] };

    for (const id of ids) {
      try {
        await quoteService.deleteQuote(id);
        results.deleted++;
      } catch (error: any) {
        results.errors.push(`Quote ${id}: ${error.message}`);
      }
    }

    // Clear cache after bulk delete
    quoteService.clearCache();

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("[Admin Quotes API] Error deleting quotes:", error);
    return NextResponse.json(
      { error: "Failed to delete quotes", details: error.message },
      { status: 500 }
    );
  }
}
