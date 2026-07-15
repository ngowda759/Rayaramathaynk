// Intent Management API Route
// GET /api/ai/settings/intents - Get all intents
// POST /api/ai/settings/intents - Add new intent
// PUT /api/ai/settings/intents - Update intent
// DELETE /api/ai/settings/intents - Remove intent

import { NextRequest, NextResponse } from "next/server";
import { aiSettingsService } from "@/lib/ai/ai-settings";
import { IntentMetadata } from "@/types/ai-settings";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const enabledOnly = searchParams.get("enabledOnly") === "true";
    const topUsed = searchParams.get("topUsed");

    if (topUsed) {
      const intents = await aiSettingsService.getTopUsedIntents(parseInt(topUsed));
      return NextResponse.json({ intents });
    }

    const intents = enabledOnly
      ? await aiSettingsService.getEnabledIntents()
      : await aiSettingsService.getIntents();

    return NextResponse.json({ intents });
  } catch (error) {
    console.error("Error fetching intents:", error);
    return NextResponse.json(
      { error: "Failed to fetch intents" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "admin";
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "Intent name is required" },
        { status: 400 }
      );
    }

    const newIntent: IntentMetadata = {
      id: body.id || `intent_${Date.now()}`,
      intentId: body.intentId,
      name: body.name,
      description: body.description || "",
      status: body.status || "enabled",
      keywords: body.keywords || [],
      examples: body.examples || [],
      confidence: body.confidence || body.baseConfidence || 0.8,
      knowledgeSource: body.knowledgeSource,
      route: body.route,
      usageCount: 0,
      createdAt: new Date(),
    };

    await aiSettingsService.addIntent(newIntent, userId);

    return NextResponse.json({
      message: "Intent added successfully",
      intent: newIntent,
    });
  } catch (error) {
    console.error("Error adding intent:", error);
    return NextResponse.json(
      { error: "Failed to add intent" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "admin";
    const body = await request.json();
    const { intentId, ...updates } = body;

    if (!intentId) {
      return NextResponse.json(
        { error: "Intent ID is required" },
        { status: 400 }
      );
    }

    await aiSettingsService.updateIntent(intentId, updates, userId);

    return NextResponse.json({
      message: "Intent updated successfully",
    });
  } catch (error) {
    console.error("Error updating intent:", error);
    return NextResponse.json(
      { error: "Failed to update intent" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "admin";
    const { searchParams } = new URL(request.url);
    const intentId = searchParams.get("intentId");

    if (!intentId) {
      return NextResponse.json(
        { error: "Intent ID is required" },
        { status: 400 }
      );
    }

    await aiSettingsService.removeIntent(intentId, userId);

    return NextResponse.json({
      message: "Intent removed successfully",
    });
  } catch (error) {
    console.error("Error removing intent:", error);
    return NextResponse.json(
      { error: "Failed to remove intent" },
      { status: 500 }
    );
  }
}
