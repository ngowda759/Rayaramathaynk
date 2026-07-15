// Temple Policies API Route
// GET /api/ai/settings/policies - Get temple policies
// PUT /api/ai/settings/policies - Update temple policies

import { NextRequest, NextResponse } from "next/server";
import { aiSettingsService } from "@/lib/ai/ai-settings";

export async function GET() {
  try {
    const templePolicies = await aiSettingsService.getTemplePolicies();
    return NextResponse.json(templePolicies);
  } catch (error) {
    console.error("Error fetching temple policies:", error);
    return NextResponse.json(
      { error: "Failed to fetch temple policies" },
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
      case "donations":
        await aiSettingsService.updateDonationPolicy(data, userId);
        break;
      case "information80G":
        await aiSettingsService.update80GPolicy(data, userId);
        break;
      case "sevaBooking":
        await aiSettingsService.updateSevaBookingPolicy(data, userId);
        break;
      case "all":
        await aiSettingsService.updateTemplePolicies(data, userId);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown section: ${section}` },
          { status: 400 }
        );
    }

    const updatedTemplePolicies = await aiSettingsService.getTemplePolicies();
    return NextResponse.json(updatedTemplePolicies);
  } catch (error) {
    console.error("Error updating temple policies:", error);
    return NextResponse.json(
      { error: "Failed to update temple policies" },
      { status: 500 }
    );
  }
}
