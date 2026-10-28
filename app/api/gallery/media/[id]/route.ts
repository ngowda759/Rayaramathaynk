import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { galleryService } from "@/services/gallery.server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const media = await galleryService.getMediaById(id);
  if (!media) return NextResponse.json({ error: "Media not found" }, { status: 404 });
  return NextResponse.json(media);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await galleryService.updateMedia(id, await request.json());
    return NextResponse.json({ message: "Media updated" });
  } catch (error) {
    console.error("[gallery/media/:id] update failed:", error);
    return NextResponse.json({ error: "Failed to update gallery media" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await galleryService.deleteMedia(id);
    return NextResponse.json({ message: "Media deleted" });
  } catch (error) {
    console.error("[gallery/media/:id] delete failed:", error);
    return NextResponse.json({ error: "Failed to delete gallery media" }, { status: 500 });
  }
}
