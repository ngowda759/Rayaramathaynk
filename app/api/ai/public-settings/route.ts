import { NextRequest, NextResponse } from "next/server";
import { aiSettingsService } from "@/lib/ai/ai-settings";

// Public endpoint to safely return non-admin configurations like welcome messages
export async function GET(request: NextRequest) {
  try {
    const aiResponses = await aiSettingsService.getAIResponses();
    return NextResponse.json({
      welcome: aiResponses.welcome,
    });
  } catch (error) {
    console.error("Error fetching public AI settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI settings" },
      { status: 500 }
    );
  }
}
