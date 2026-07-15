// AI Settings API Route
// GET /api/ai/settings - Get AI settings
// POST /api/ai/settings - Create/update AI settings

import { NextRequest, NextResponse } from "next/server";
import { aiSettingsService } from "@/lib/ai/ai-settings";

export async function GET() {
  try {
    const settings = await aiSettingsService.getAISettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching AI settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // For now, get user ID from header or use "admin" as default
    // TODO: Add proper admin authentication
    const userId = request.headers.get("x-user-id") || "admin";

    const body = await request.json();
    const { action, data } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "updateTempleInformation":
        await aiSettingsService.updateTempleInformation(data, userId);
        break;

      case "updateVisitorInformation":
        await aiSettingsService.updateVisitorInformation(data, userId);
        break;

      case "updateTemplePolicies":
        await aiSettingsService.updateTemplePolicies(data, userId);
        break;

      case "updateAIResponses":
        await aiSettingsService.updateAIResponses(data, userId);
        break;

      case "updateAIBehavior":
        await aiSettingsService.updateAIBehavior(data, userId);
        break;

      case "resetToDefaults":
        await aiSettingsService.resetToDefaults(userId);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    const updatedSettings = await aiSettingsService.getAISettings();
    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error("Error updating AI settings:", error);
    return NextResponse.json(
      { error: "Failed to update AI settings" },
      { status: 500 }
    );
  }
}
