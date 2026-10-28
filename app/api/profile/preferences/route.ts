import { NextRequest, NextResponse } from "next/server";

import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { profileService } from "@/services/profile.server";

export async function PUT(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await profileService.updatePreferences(caller.uid, await request.json());
    return NextResponse.json({ message: "Preferences updated" });
  } catch (error) {
    console.error("[profile/preferences] update failed:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
