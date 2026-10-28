import { NextRequest, NextResponse } from "next/server";

import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { profileService } from "@/services/profile.server";
import type { BookmarkType } from "@/types/profile";

export async function GET(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const type = request.nextUrl.searchParams.get("type") as BookmarkType | null;
  try {
    return NextResponse.json(await profileService.getBookmarks(caller.uid, type ?? undefined));
  } catch (error) {
    console.error("[profile/bookmarks] read failed:", error);
    return NextResponse.json({ error: "Failed to read bookmarks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await profileService.addBookmark(caller.uid, await request.json()));
  } catch (error) {
    console.error("[profile/bookmarks] add failed:", error);
    return NextResponse.json({ error: "Failed to add bookmark" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { bookmarkId?: string };
  if (!body.bookmarkId) return NextResponse.json({ error: "bookmarkId is required" }, { status: 400 });
  try {
    await profileService.removeBookmark(caller.uid, body.bookmarkId);
    return NextResponse.json({ message: "Bookmark removed" });
  } catch (error) {
    console.error("[profile/bookmarks] remove failed:", error);
    return NextResponse.json({ error: "Failed to remove bookmark" }, { status: 500 });
  }
}
