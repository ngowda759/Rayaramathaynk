import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { galleryService } from "@/services/gallery.server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const album = await galleryService.getAlbum(id);
  if (!album) return NextResponse.json({ error: "Album not found" }, { status: 404 });
  return NextResponse.json(album);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await galleryService.updateAlbum(id, await request.json());
    return NextResponse.json({ message: "Album updated" });
  } catch (error) {
    console.error("[gallery/albums/:id] update failed:", error);
    return NextResponse.json({ error: "Failed to update gallery album" }, { status: 500 });
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
    await galleryService.deleteAlbum(id);
    return NextResponse.json({ message: "Album deleted" });
  } catch (error) {
    console.error("[gallery/albums/:id] delete failed:", error);
    return NextResponse.json({ error: "Failed to delete gallery album" }, { status: 500 });
  }
}
