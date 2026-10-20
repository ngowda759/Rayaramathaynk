// Temple Information API Route
// GET /api/ai/settings/temple-information - Get temple information
// PUT /api/ai/settings/temple-information - Update temple information

import { NextRequest, NextResponse } from "next/server";
import { aiSettingsService } from "@/lib/ai/ai-settings";
import { requireRayaAdminUser } from "@/lib/auth/raya-admin-auth";

// This endpoint is admin-authenticated and returns user-scoped data; it must
// never be cached publicly (or cached at all across users).
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireRayaAdminUser(request);
  if (!guard.ok) return guard.response;
  const admin = guard.user;

  try {
    const templeInformation = await aiSettingsService.getTempleInformation();
    return NextResponse.json(templeInformation, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error fetching temple information:", error);
    return NextResponse.json(
      { error: "Failed to fetch temple information" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Get user ID from header or use "admin" as default
    const guard = await requireRayaAdminUser(request);
    if (!guard.ok) return guard.response;
    const admin = guard.user;
    const userId = admin.uid;

    const body = await request.json();
    const { section, data } = body;

    switch (section) {
      case "timings":
        await aiSettingsService.updateTempleTimings(data, userId);
        break;

      case "contact":
        await aiSettingsService.updateTempleContact(data, userId);
        break;

      case "officeHours":
        await aiSettingsService.updateTempleOfficeHours(data, userId);
        break;

      case "all":
        await aiSettingsService.updateTempleInformation(data, userId);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown section: ${section}` },
          { status: 400 }
        );
    }

    const updatedTempleInformation = await aiSettingsService.getTempleInformation();
    return NextResponse.json(updatedTempleInformation);
  } catch (error) {
    console.error("Error updating temple information:", error);
    return NextResponse.json(
      { error: "Failed to update temple information" },
      { status: 500 }
    );
  }
}
