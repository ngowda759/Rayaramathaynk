// AI Behavior Settings API Route
// GET /api/ai/settings/ai-behavior - Get AI behavior settings
// PUT /api/ai/settings/ai-behavior - Update AI behavior settings

import { NextRequest, NextResponse } from "next/server";
import { aiSettingsService } from "@/lib/ai/ai-settings";
import { AIBehaviorSettings } from "@/types/ai-settings";
import { requireAdminUser } from "@/lib/auth/admin-auth";

export async function GET(request: NextRequest) {
  const guard = await requireAdminUser(request);
  if (!guard.ok) return guard.response;
  const admin = guard.user;

  try {
    const aiBehavior = await aiSettingsService.getAIBehavior();
    return NextResponse.json(aiBehavior);
  } catch (error) {
    console.error("Error fetching AI behavior settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI behavior settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await requireAdminUser(request);
    if (!guard.ok) return guard.response;
    const admin = guard.user;
    const userId = admin.uid;
    const body = await request.json();
    const { setting, value } = body;

    switch (setting) {
      case "confidenceThreshold":
        await aiSettingsService.setConfidenceThreshold(value, userId);
        break;
      case "debugMode":
        await aiSettingsService.setDebugMode(value, userId);
        break;
      case "streamingResponses":
        await aiSettingsService.setStreamingResponses(value, userId);
        break;
      case "all": {
        // Support both spread body and nested data property, and strictly reconstruct to strip out 'setting' field
        const rawData = body.data || body;
        const behaviorData: AIBehaviorSettings = {
          confidenceThreshold: rawData.confidenceThreshold ?? 85,
          semanticThreshold: rawData.semanticThreshold ?? 70,
          maxRelatedArticles: rawData.maxRelatedArticles ?? 3,
          conversationTimeout: rawData.conversationTimeout ?? 30,
          streaming: rawData.streaming ?? false,
          debugMode: rawData.debugMode ?? false,
          unknownLogging: rawData.unknownLogging ?? true,
        };
        await aiSettingsService.updateAIBehavior(behaviorData, userId);
        break;
      }
      default:
        return NextResponse.json(
          { error: `Unknown setting: ${setting}` },
          { status: 400 },
        );
    }

    const updatedAIBehavior = await aiSettingsService.getAIBehavior();
    return NextResponse.json(updatedAIBehavior);
  } catch (error) {
    console.error("Error updating AI behavior settings:", error);
    return NextResponse.json(
      { error: "Failed to update AI behavior settings" },
      { status: 500 },
    );
  }
}
