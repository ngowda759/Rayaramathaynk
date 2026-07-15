// AI Behavior Settings API Route
// GET /api/ai/settings/ai-behavior - Get AI behavior settings
// PUT /api/ai/settings/ai-behavior - Update AI behavior settings

import { NextRequest, NextResponse } from "next/server";
import { aiSettingsService } from "@/lib/ai/ai-settings";
import { AIBehaviorSettings } from "@/types/ai-settings";

export async function GET() {
  try {
    const aiBehavior = await aiSettingsService.getAIBehavior();
    return NextResponse.json(aiBehavior);
  } catch (error) {
    console.error("Error fetching AI behavior settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI behavior settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "admin";
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
      case "all":
        await aiSettingsService.updateAIBehavior(body as AIBehaviorSettings, userId);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown setting: ${setting}` },
          { status: 400 }
        );
    }

    const updatedAIBehavior = await aiSettingsService.getAIBehavior();
    return NextResponse.json(updatedAIBehavior);
  } catch (error) {
    console.error("Error updating AI behavior settings:", error);
    return NextResponse.json(
      { error: "Failed to update AI behavior settings" },
      { status: 500 }
    );
  }
}
