import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { galleryService } from "@/services/gallery.server";

/**
 * Gallery media. The public gallery reads this; adding media requires an
 * authenticated administrator. `?album=<id>` and `?featured=1` filter the list.
 */
export async function GET(request: NextRequest) {
  try {
    const album = request.nextUrl.searchParams.get("album");
    const featured = request.nextUrl.searchParams.get("featured");
    const media = album
      ? await galleryService.getMediaByAlbum(album)
      : featured === "1"
        ? await galleryService.getFeaturedMedia()
        : await galleryService.getMedia();
    return NextResponse.json(media);
  } catch (error) {
    console.error("[gallery/media] read failed:", error);
    return NextResponse.json({ error: "Failed to fetch gallery media" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as { media: unknown; uploadedBy?: string };
    const id = await galleryService.createMedia(
      body.media as never,
      body.uploadedBy ?? auth.user.email
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("[gallery/media] create failed:", error);
    return NextResponse.json({ error: "Failed to create gallery media" }, { status: 500 });
  }
}
