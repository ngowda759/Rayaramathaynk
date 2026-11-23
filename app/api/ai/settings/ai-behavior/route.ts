// AI Behavior Settings API Route
// GET /api/ai/settings/ai-behavior - Get AI behavior settings
// PUT /api/ai/settings/ai-behavior - Update AI behavior settings

import { NextRequest, NextResponse } from "next/server";
import { aiSettingsService } from "@/lib/ai/ai-settings";
import { AIBehaviorSettings, DEFAULT_AI_BEHAVIOR_SETTINGS } from "@/types/ai-settings";
import { AIExtendedBehaviorSettingsSchema } from "@/lib/ai/ai-settings/validation";
import { requireAdminCapability } from "@/lib/auth/admin-capabilities";

/**
 * Validate the 0-1 `confidenceThreshold`/`semanticThreshold` representation.
 * The persisted scale is a ratio (`0.85`); a percentage such as `85` is a
 * different scale and is rejected rather than silently coerced.
 */
function validateBehaviorSettings(candidate: AIBehaviorSettings): string | null {
  const parsed = AIExtendedBehaviorSettingsSchema.safeParse({
    ...candidate,
    enableFollowUpContext: true,
    enableSuggestedQuestions: true,
    enableAnalytics: true,
    enableUnknownQuestionLogging: candidate.unknownLogging,
    enableDebugMode: candidate.debugMode,
    maxKnowledgeResults: DEFAULT_AI_BEHAVIOR_SETTINGS.maxRelatedArticles,
  });
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
      .join("; ");
    return detail || "Invalid AI behavior settings";
  }
  return null;
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminCapability(request, "ai.settings.read");
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
    const guard = await requireAdminCapability(request, "ai.settings.write");
    if (!guard.ok) return guard.response;
    const admin = guard.user;
    const userId = admin.uid;
    const body = await request.json();
    const { setting, value } = body;

    switch (setting) {
      case "confidenceThreshold": {
        const error = validateBehaviorSettings({
          ...(await aiSettingsService.getAIBehavior()),
          confidenceThreshold: value,
        });
        if (error) {
          return NextResponse.json(
            { error: `Invalid confidenceThreshold: expected a 0-1 ratio such as 0.85 (${error})` },
            { status: 400 },
          );
        }
        await aiSettingsService.setConfidenceThreshold(value, userId);
        break;
      }
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
          confidenceThreshold: rawData.confidenceThreshold ?? DEFAULT_AI_BEHAVIOR_SETTINGS.confidenceThreshold,
          semanticThreshold: rawData.semanticThreshold ?? DEFAULT_AI_BEHAVIOR_SETTINGS.semanticThreshold,
          maxRelatedArticles: rawData.maxRelatedArticles ?? 3,
          conversationTimeout: rawData.conversationTimeout ?? 30,
          streaming: rawData.streaming ?? false,
          debugMode: rawData.debugMode ?? false,
          unknownLogging: rawData.unknownLogging ?? true,
        };
        const error = validateBehaviorSettings(behaviorData);
        if (error) {
          return NextResponse.json(
            { error: `Invalid AI behavior settings: ${error}` },
            { status: 400 },
          );
        }
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
