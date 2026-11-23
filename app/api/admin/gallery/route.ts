import { NextRequest, NextResponse } from "next/server";

import { requireAdminCapability } from "@/lib/auth/admin-capabilities";
import { galleryService } from "@/services/gallery.server";

/**
 * Gallery media and albums for the admin media console.
 *
 * Delegates to `galleryService`, which reads Supabase `gallery_albums` /
 * `gallery_media` with the service role (both tables are deny-all under RLS).
 * Admin-only. There is no Firestore or Firebase Storage path.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminCapability(request, "gallery.read");
  if (!auth.ok) return auth.response;

  try {
    const [albums, media] = await Promise.all([
      galleryService.getAlbums(),
      galleryService.getMedia(),
    ]);
    return NextResponse.json({ success: true, albums, media });
  } catch (error) {
    console.error("[admin/gallery] read failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load gallery" }, { status: 500 });
  }
}
