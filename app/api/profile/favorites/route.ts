import { NextRequest, NextResponse } from "next/server";

import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { allowPublicWrite } from "@/lib/api/public-rate-limit";
import { itemIdSchema } from "@/lib/validation/public-submissions";
import { parseJsonBody } from "@/lib/validation/http";
import { profileService } from "@/services/profile.server";

/**
 * The signed-in caller's own favorites. Ownership is the verified token's uid, so a
 * caller can only add or remove items on their own profile.
 */
export async function POST(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!allowPublicWrite(request, { scope: "profile:favorites", identity: caller.uid, limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, itemIdSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await profileService.addFavorite(caller.uid, parsed.data.itemId);
    return NextResponse.json({ message: "Favorite added" });
  } catch (error) {
    console.error("[profile/favorites] add failed:", error);
    return NextResponse.json({ error: "Failed to add favorite" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(request, itemIdSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await profileService.removeFavorite(caller.uid, parsed.data.itemId);
    return NextResponse.json({ message: "Favorite removed" });
  } catch (error) {
    console.error("[profile/favorites] remove failed:", error);
    return NextResponse.json({ error: "Failed to remove favorite" }, { status: 500 });
  }
}
