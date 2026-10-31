import { NextRequest, NextResponse } from "next/server";

import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { allowPublicWrite } from "@/lib/api/public-rate-limit";
import { itemIdSchema } from "@/lib/validation/public-submissions";
import { parseJsonBody } from "@/lib/validation/http";
import { profileService } from "@/services/profile.server";

/**
 * Records an item the signed-in caller viewed, on their own profile. Ownership is the
 * verified token's uid.
 */
export async function POST(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!allowPublicWrite(request, { scope: "profile:recently-viewed", identity: caller.uid, limit: 120, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, itemIdSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await profileService.addRecentlyViewed(caller.uid, parsed.data.itemId);
    return NextResponse.json({ message: "Recorded" });
  } catch (error) {
    console.error("[profile/recently-viewed] failed:", error);
    return NextResponse.json({ error: "Failed to record view" }, { status: 500 });
  }
}
