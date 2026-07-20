// Publish Prompt API Route
// POST /api/admin/prompts/:id/publish - Publish a prompt version

import { NextRequest, NextResponse } from "next/server";
import { aiSettingsService } from "@/lib/ai/ai-settings";

/**
 * POST /api/admin/prompts/:id/publish
 * Publish a prompt version (makes it active)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id") || "admin";

    // Verify the prompt version exists
    const promptVersions = await aiSettingsService.getPromptVersions();
    const version = promptVersions.find((v: any) => v.id === id);

    if (!version) {
      return NextResponse.json(
        { success: false, error: "Prompt version not found" },
        { status: 404 }
      );
    }

    // Publish the version
    await aiSettingsService.publishPromptVersion(id, userId);

    // Get updated versions
    const updatedVersions = await aiSettingsService.getPromptVersions();
    const currentPrompt = await aiSettingsService.getCurrentPrompt();

    return NextResponse.json({
      success: true,
      message: `Prompt "${version.name || version.id}" published successfully`,
      currentPrompt,
      versions: updatedVersions,
    });
  } catch (error) {
    console.error("Error publishing prompt version:", error);
    return NextResponse.json(
      { success: false, error: "Failed to publish prompt version" },
      { status: 500 }
    );
  }
}
