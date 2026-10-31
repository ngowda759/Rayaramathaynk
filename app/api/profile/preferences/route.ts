import { NextRequest, NextResponse } from "next/server";

import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { allowPublicWrite } from "@/lib/api/public-rate-limit";
import { preferencesSchema } from "@/lib/validation/public-submissions";
import { parseJsonBody } from "@/lib/validation/http";
import { profileService } from "@/services/profile.server";

/**
 * Updates the signed-in caller's own preferences. Ownership is the verified token's
 * uid; the body is restricted to the known preference keys.
 */
export async function PUT(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!allowPublicWrite(request, { scope: "profile:preferences", identity: caller.uid, limit: 120, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, preferencesSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await profileService.updatePreferences(caller.uid, parsed.data);
    return NextResponse.json({ message: "Preferences updated" });
  } catch (error) {
    console.error("[profile/preferences] update failed:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
