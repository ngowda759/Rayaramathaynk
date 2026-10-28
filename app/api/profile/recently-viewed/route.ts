import { NextRequest, NextResponse } from "next/server";

import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { profileService } from "@/services/profile.server";

export async function POST(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { itemId?: string };
  if (!body.itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  try {
    await profileService.addRecentlyViewed(caller.uid, body.itemId);
    return NextResponse.json({ message: "Recorded" });
  } catch (error) {
    console.error("[profile/recently-viewed] failed:", error);
    return NextResponse.json({ error: "Failed to record view" }, { status: 500 });
  }
}
