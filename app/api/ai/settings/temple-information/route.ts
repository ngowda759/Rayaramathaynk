// Temple Information API Route
// GET /api/ai/settings/temple-information - Get temple information
// PUT /api/ai/settings/temple-information - Update temple information

import { NextRequest, NextResponse } from "next/server";
import { aiSettingsService } from "@/lib/ai/ai-settings";

export const revalidate = 3600;

export async function GET() {
  try {
    const templeInformation = await aiSettingsService.getTempleInformation();
    return NextResponse.json(templeInformation, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
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
    const userId = request.headers.get("x-user-id") || "admin";

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
