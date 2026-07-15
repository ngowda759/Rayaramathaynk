// Visitor Information API Route
// GET /api/ai/settings/visitor-information - Get visitor information
// PUT /api/ai/settings/visitor-information - Update visitor information

import { NextRequest, NextResponse } from "next/server";
import { aiSettingsService } from "@/lib/ai/ai-settings";

export async function GET() {
  try {
    const visitorInformation = await aiSettingsService.getVisitorInformation();
    return NextResponse.json(visitorInformation);
  } catch (error) {
    console.error("Error fetching visitor information:", error);
    return NextResponse.json(
      { error: "Failed to fetch visitor information" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "admin";
    const body = await request.json();
    const { section, data } = body;

    switch (section) {
      case "visitorGuidelines":
        await aiSettingsService.updateVisitorGuidelines(data, userId);
        break;
      case "dressCode":
        await aiSettingsService.updateDressCode(data, userId);
        break;
      case "photographyPolicy":
        await aiSettingsService.updatePhotographyPolicy(data, userId);
        break;
      case "parking":
        await aiSettingsService.updateParking(data, userId);
        break;
      case "facilities":
        await aiSettingsService.updateFacilities(data, userId);
        break;
      case "annadanam":
        await aiSettingsService.updateAnnadanam(data, userId);
        break;
      case "accommodation":
        await aiSettingsService.updateAccommodation(data, userId);
        break;
      case "volunteerInfo":
        await aiSettingsService.updateVolunteerInfo(data, userId);
        break;
      case "all":
        await aiSettingsService.updateVisitorInformation(data, userId);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown section: ${section}` },
          { status: 400 }
        );
    }

    const updatedVisitorInformation = await aiSettingsService.getVisitorInformation();
    return NextResponse.json(updatedVisitorInformation);
  } catch (error) {
    console.error("Error updating visitor information:", error);
    return NextResponse.json(
      { error: "Failed to update visitor information" },
      { status: 500 }
    );
  }
}
