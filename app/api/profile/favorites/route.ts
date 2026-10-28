import { NextRequest, NextResponse } from "next/server";

import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { profileService } from "@/services/profile.server";

async function itemId(request: NextRequest): Promise<string | null> {
  const body = (await request.json().catch(() => ({}))) as { itemId?: string };
  return typeof body.itemId === "string" && body.itemId ? body.itemId : null;
}

export async function POST(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await itemId(request);
  if (!id) return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  try {
    await profileService.addFavorite(caller.uid, id);
    return NextResponse.json({ message: "Favorite added" });
  } catch (error) {
    console.error("[profile/favorites] add failed:", error);
    return NextResponse.json({ error: "Failed to add favorite" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await itemId(request);
  if (!id) return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  try {
    await profileService.removeFavorite(caller.uid, id);
    return NextResponse.json({ message: "Favorite removed" });
  } catch (error) {
    console.error("[profile/favorites] remove failed:", error);
    return NextResponse.json({ error: "Failed to remove favorite" }, { status: 500 });
  }
}
