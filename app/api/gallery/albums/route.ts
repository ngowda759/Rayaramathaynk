import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { galleryService } from "@/services/gallery.server";

/**
 * Gallery albums. Public site content, so the list is readable by anyone; creating an
 * album requires an authenticated administrator.
 */
export async function GET() {
  try {
    return NextResponse.json(await galleryService.getAlbums());
  } catch (error) {
    console.error("[gallery/albums] read failed:", error);
    return NextResponse.json({ error: "Failed to fetch gallery albums" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const id = await galleryService.createAlbum(body);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("[gallery/albums] create failed:", error);
    return NextResponse.json({ error: "Failed to create gallery album" }, { status: 500 });
  }
}
