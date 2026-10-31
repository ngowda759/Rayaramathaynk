import { NextRequest, NextResponse } from "next/server";

import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { allowPublicWrite } from "@/lib/api/public-rate-limit";
import { bookmarkIdSchema, bookmarkSchema, bookmarkTypeSchema } from "@/lib/validation/public-submissions";
import { parseJsonBody, validateBody } from "@/lib/validation/http";
import { profileService } from "@/services/profile.server";

/**
 * The signed-in caller's own bookmarks. Ownership is the verified token's uid, so a
 * caller can only read, add or remove their own bookmarks. A new bookmark's `id` and
 * `createdAt` are generated server-side; a body cannot supply them.
 */
export async function GET(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawType = request.nextUrl.searchParams.get("type");
  let type: string | undefined;
  if (rawType) {
    const parsed = validateBody(rawType, bookmarkTypeSchema);
    if (!parsed.ok) return parsed.response;
    type = parsed.data;
  }

  try {
    return NextResponse.json(await profileService.getBookmarks(caller.uid, type as never));
  } catch (error) {
    console.error("[profile/bookmarks] read failed:", error);
    return NextResponse.json({ error: "Failed to read bookmarks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!allowPublicWrite(request, { scope: "profile:bookmarks", identity: caller.uid, limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, bookmarkSchema);
  if (!parsed.ok) return parsed.response;

  try {
    return NextResponse.json(await profileService.addBookmark(caller.uid, parsed.data));
  } catch (error) {
    console.error("[profile/bookmarks] add failed:", error);
    return NextResponse.json({ error: "Failed to add bookmark" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(request, bookmarkIdSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await profileService.removeBookmark(caller.uid, parsed.data.bookmarkId);
    return NextResponse.json({ message: "Bookmark removed" });
  } catch (error) {
    console.error("[profile/bookmarks] remove failed:", error);
    return NextResponse.json({ error: "Failed to remove bookmark" }, { status: 500 });
  }
}
