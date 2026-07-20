// Prompt Management API Route for Admin - Single Prompt
// GET /api/admin/prompts/:id - Get specific prompt version
// DELETE /api/admin/prompts/:id - Delete a prompt version

import { NextRequest, NextResponse } from "next/server";
import { aiSettingsService } from "@/lib/ai/ai-settings";

/**
 * GET /api/admin/prompts/:id
 * Get a specific prompt version by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const promptVersions = await aiSettingsService.getPromptVersions();
    const version = promptVersions.find((v: any) => v.id === id);

    if (!version) {
      return NextResponse.json(
        { success: false, error: "Prompt version not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: version,
    });
  } catch (error) {
    console.error("Error fetching prompt version:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch prompt version" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/prompts/:id
 * Delete a prompt version
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id") || "admin";

    // Get all versions to find the one to delete
    const promptVersions = await aiSettingsService.getPromptVersions();
    const version = promptVersions.find((v: any) => v.id === id);

    if (!version) {
      return NextResponse.json(
        { success: false, error: "Prompt version not found" },
        { status: 404 }
      );
    }

    const currentPromptId = (await aiSettingsService.getPromptSettings())?.currentPromptId;
    const isCurrent = currentPromptId === id;

    // If deleting current prompt, this could cause issues - warn but allow
    if (isCurrent) {
      return NextResponse.json({
        success: false,
        error: "Cannot delete the currently active prompt. Publish another prompt first.",
      }, { status: 400 });
    }

    // Archive the version instead of deleting
    await aiSettingsService.updatePromptVersion(id, { status: "archived" }, userId);

    return NextResponse.json({
      success: true,
      message: "Prompt version archived successfully",
    });
  } catch (error) {
    console.error("Error deleting prompt version:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete prompt version" },
      { status: 500 }
    );
  }
}
